# ELove Publishing Engine — Deep Technical Design

**Version:** 1.0
**Date:** March 3, 2026
**Scope:** The complete system that converts edited JSON projects into live, globally-distributed static wedding invitation websites — covering build, storage, CDN, domains, SSL, analytics, quotas, failure recovery, and cost modeling.
**Prerequisites:** `architecture-saas-wedding-platform.md`, `template-engine-deep-dive.md` (15-step render pipeline), `visual-editor-system-design.md` (autosave, versioning)

---

## Table of Contents

1. Publish Pipeline (State Machine)
2. Storage Strategy
3. CDN Strategy
4. Domain Routing Strategy
5. SSL Automation Approach
6. Cost Estimation Model
7. Failure Recovery Strategy
8. Scaling to 1M Monthly Visits

---

## 1. Publish Pipeline — Complete State Machine

The previous architecture doc defined six high-level steps. This section specifies the exact state machine, queue mechanics, timeout handling, and observability for each step.

### 1.1 Pipeline State Machine

```
                              ┌────────────┐
                              │  IDLE       │ ← project.status: "draft" or "published"
                              │  (no build) │   (previous build complete or never built)
                              └──────┬──────┘
                                     │
                              User clicks "Publish"
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  VALIDATING      │  Synchronous. Max 2 seconds.
                            │                  │
                            │  ├─ Auth check   │
                            │  ├─ Subscription │
                            │  │   active?     │
                            │  ├─ Quota within │
                            │  │   limits?     │
                            │  ├─ Required     │
                            │  │   slots filled?│
                            │  ├─ Media refs   │
                            │  │   valid?      │
                            │  └─ Schema ver   │
                            │      compatible? │
                            └────┬────────┬────┘
                                 │        │
                            PASS │        │ FAIL
                                 │        │
                                 │        ▼
                                 │   ┌────────────┐
                                 │   │ REJECTED    │ → 422 + error details to client
                                 │   │             │   Client shows publish error modal
                                 │   └────────────┘
                                 │
                                 ▼
                      ┌───────────────────┐
                      │  SNAPSHOT          │  Synchronous. Max 1 second.
                      │                    │
                      │  1. Increment      │
                      │     version counter│
                      │  2. Freeze 4-layer │
                      │     document into  │
                      │     published_     │
                      │     versions row   │
                      │  3. Create build   │
                      │     savepoint in   │
                      │     project_       │
                      │     savepoints     │
                      │  4. Return         │
                      │     build_id to    │
                      │     client         │
                      └──────────┬────────┘
                                 │
                                 ▼
                      ┌───────────────────┐
                      │  QUEUED            │  Async. Build job pushed to queue.
                      │                    │
                      │  Queue: Redis      │
                      │  Streams (XADD)    │
                      │                    │
                      │  Priority lanes:   │
                      │  ├─ P0: Business   │  (processed first)
                      │  ├─ P1: Pro        │
                      │  ├─ P2: Starter    │
                      │  └─ P3: Free       │  (processed last, throttled)
                      │                    │
                      │  Client polls:     │
                      │  GET /projects/:id │
                      │  /publish/status   │
                      │  (or WebSocket     │
                      │   push)            │
                      └──────────┬────────┘
                                 │
                          Worker picks up job
                                 │
                                 ▼
                      ┌───────────────────┐
                      │  BUILDING          │  Async. 8-30 seconds typical.
                      │                    │
                      │  Render pipeline   │
                      │  steps 1-14        │
                      │  (from template    │
                      │  engine doc)       │
                      │                    │
                      │  Heartbeat every   │
                      │  5 seconds to      │
                      │  prevent timeout   │
                      │  reclaim           │
                      │                    │
                      │  Progress events:  │
                      │  ├─ "resolving"    │  (steps 1-5)
                      │  ├─ "compiling"    │  (steps 6-10)
                      │  ├─ "optimizing"   │  (steps 11-14)
                      │  └─ "uploading"    │  (step 15)
                      └────┬─────────┬────┘
                           │         │
                      SUCCESS    FAILURE
                           │         │
                           │         ▼
                           │    ┌────────────┐
                           │    │ BUILD_     │
                           │    │ FAILED     │ → Status: 'failed'
                           │    │            │   Error stored in
                           │    │            │   published_versions.
                           │    │            │   build_error
                           │    │            │   Client shows failure
                           │    │            │   with retry button
                           │    └────────────┘
                           │
                           ▼
                      ┌───────────────────┐
                      │  DEPLOYING         │  Async. 2-5 seconds.
                      │                    │
                      │  1. Upload all     │
                      │     files to R2    │
                      │     (parallel,     │
                      │      50 concurrent)│
                      │  2. Verify upload  │
                      │     integrity      │
                      │     (checksum each │
                      │      file against  │
                      │      build manifest│
                      │  3. Atomic KV      │
                      │     routing update │
                      │  4. CDN cache      │
                      │     purge for      │
                      │     index.html     │
                      │  5. Branding badge │
                      │     injection rule │
                      │     (free plan)    │
                      └────┬─────────┬────┘
                           │         │
                      SUCCESS    FAILURE
                           │         │
                           │         ▼
                           │    ┌────────────┐
                           │    │ DEPLOY_    │ → Build artifacts exist in R2
                           │    │ FAILED     │   but routing not updated.
                           │    │            │   Previous version still live.
                           │    │            │   Auto-retry 3x, then alert.
                           │    └────────────┘
                           │
                           ▼
                      ┌───────────────────┐
                      │  LIVE              │
                      │                    │
                      │  Status: 'live'    │
                      │  Previous version: │
                      │    'superseded'    │
                      │  Notify client     │
                      │  via WebSocket     │
                      │                    │
                      │  Published URL:    │
                      │  {slug}.elove.me   │
                      │  (+ custom domain  │
                      │   if configured)   │
                      └───────────────────┘
```

### 1.2 Queue Mechanics (Redis Streams)

```
QUEUE DESIGN:

  Stream name: publish:builds
  Consumer group: build-workers

  Message structure:
  {
    buildId:        "bld_abc123",
    projectId:      "proj_xyz",
    tenantId:       "tnt_def",
    version:        7,
    priority:       1,                    // 0=Business, 1=Pro, 2=Starter, 3=Free
    documentHash:   "sha256:abc...",      // for dedup
    enqueuedAt:     1709510400000,
    snapshotRef:    "published_versions:uuid"
  }

  Consumer mechanics:
  - Worker calls XREADGROUP with BLOCK 5000 (5s long-poll)
  - On receive: XCLAIM with 60-second visibility timeout
  - Worker sends heartbeat (XCLAIM refresh) every 15 seconds
  - On success: XACK to remove from pending
  - On failure: NACK returns message to stream for retry
  - After 3 failures: move to dead-letter stream (publish:builds:dlq)

  Priority implementation:
  - Four separate streams: publish:p0, publish:p1, publish:p2, publish:p3
  - Workers read from P0 first (XREADGROUP), then P1, P2, P3
  - This ensures paid users never wait behind free tier builds

  Dedup:
  - Before enqueueing: check if buildId or documentHash already in stream
  - If user clicks "Publish" twice quickly, second request is deduplicated
  - Dedup window: 60 seconds (Redis SET with NX and EX)
```

### 1.3 Build Timeout and Reclaim

```
TIMEOUT POLICY:

  Build timeout: 120 seconds (hard limit)
  Deploy timeout: 30 seconds (hard limit)

  If a worker dies mid-build:
  1. No heartbeat received for 60 seconds
  2. Redis Streams XCLAIM allows another consumer to pick up the message
  3. New worker starts the build from scratch (snapshot is immutable)
  4. Dead worker's partial R2 uploads are orphaned
     → Cleaned by daily R2 lifecycle policy (delete objects with
        no matching published_versions row, older than 24 hours)

  If build exceeds 120s:
  1. Worker self-terminates the build
  2. published_versions.status → 'failed'
  3. published_versions.build_error → 'Build timeout exceeded (120s).
     This project may be too complex. Contact support.'
  4. Alert sent to ops monitoring (this indicates a pathological template)
```

### 1.4 Republish Strategy

```
REPUBLISH = EXACTLY THE SAME PIPELINE AS FIRST PUBLISH.

  Key behaviors:
  1. New version number assigned (incrementing)
  2. New snapshot taken (even if user hasn't changed anything — this captures
     any template updates or media reprocessing that happened since last publish)
  3. Previous version's status: 'live' → 'superseded'
  4. Previous version's R2 files are NOT deleted (retained for rollback)
  5. KV routing atomically switches to new R2 prefix
  6. Only index.html is purged from CDN (hashed assets are new URLs)

  Republish throttle:
  - Max 10 publishes per hour per project (any plan)
  - Max 30 publishes per day per tenant (free plan)
  - Rate limit enforced at VALIDATING step
  - Prevents accidental publish storms and build queue saturation
```

---

## 2. Storage Strategy

### 2.1 Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        STORAGE TOPOLOGY                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLOUDFLARE R2 (Primary object store)                            │   │
│  │                                                                   │   │
│  │  Bucket: elove-production                                        │   │
│  │                                                                   │   │
│  │  published/{projectId}/v{version}/                               │   │
│  │  ├── index.html                          (~15-50KB)              │   │
│  │  ├── style.{hash}.css                    (~10-30KB)              │   │
│  │  ├── shared.{hash}.js                    (~5-8KB)                │   │
│  │  ├── islands/                                                    │   │
│  │  │   ├── countdown.{hash}.js             (~2KB)                  │   │
│  │  │   ├── rsvp-form.{hash}.js             (~5KB)                  │   │
│  │  │   ├── gallery.{hash}.js               (~4KB)                  │   │
│  │  │   └── ...                                                     │   │
│  │  ├── assets/                                                     │   │
│  │  │   ├── hero.{hash}.webp                (user photo)            │   │
│  │  │   ├── gallery-001.{hash}.webp         (user photo)            │   │
│  │  │   └── ...                                                     │   │
│  │  └── manifest.json                       (build metadata)        │   │
│  │                                                                   │   │
│  │  published/shared/                                                │   │
│  │  ├── islands/{hash}/                     (shared across projects) │   │
│  │  │   ├── countdown.{hash}.js                                     │   │
│  │  │   └── scroll-animate.{hash}.js                                │   │
│  │  └── vendor/                                                     │   │
│  │      ├── gsap.3.12.min.js                                        │   │
│  │      └── gsap.scrolltrigger.3.12.min.js                          │   │
│  │                                                                   │   │
│  │  media/{tenantId}/{mediaId}/                                     │   │
│  │  ├── original.jpg                                                │   │
│  │  ├── thumb.webp          (150px)                                 │   │
│  │  ├── small.webp          (480px)                                 │   │
│  │  ├── medium.webp         (960px)                                 │   │
│  │  ├── large.webp          (1920px)                                │   │
│  │  └── avif/               (future: AVIF variants)                 │   │
│  │      ├── small.avif                                              │   │
│  │      └── large.avif                                              │   │
│  │                                                                   │   │
│  │  templates/{templateId}/v{version}/assets/                       │   │
│  │  ├── dividers/floral-vine.svg                                    │   │
│  │  ├── patterns/subtle-leaves.svg                                  │   │
│  │  └── loading/bloom-petals.json                                   │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLOUDFLARE KV (Edge routing table)                              │   │
│  │                                                                   │   │
│  │  Namespace: elove-routing                                        │   │
│  │                                                                   │   │
│  │  Key format              Value                                   │   │
│  │  ──────────────────────────────────────────────────────────────  │   │
│  │  slug:{slug}             {                                       │   │
│  │                            "r2Prefix": "published/proj_x/v7/",  │   │
│  │                            "buildHash": "abc123",                │   │
│  │                            "projectId": "proj_x",                │   │
│  │                            "planTier": "pro",                    │   │
│  │                            "customDomain": "wedding.smith.com",  │   │
│  │                            "passwordHash": null,                 │   │
│  │                            "publishedAt": "2026-09-01T..."       │   │
│  │                          }                                       │   │
│  │                                                                   │   │
│  │  domain:{custom-domain}  {                                       │   │
│  │                            "slug": "sarah-james",                │   │
│  │                            "projectId": "proj_x"                 │   │
│  │                          }                                       │   │
│  │                            (domain→slug mapping for reverse      │   │
│  │                             lookup, then slug→full routing)      │   │
│  │                                                                   │   │
│  │  Metadata: TTL = none (manual invalidation on publish)           │   │
│  │  Read latency: <1ms (edge-cached globally)                       │   │
│  │  Write latency: ~60s global propagation                          │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  POSTGRESQL (Source of truth for metadata)                       │   │
│  │                                                                   │   │
│  │  published_versions: build history, status, error logs           │   │
│  │  custom_domains: domain records, SSL status, CF hostname IDs     │   │
│  │  projects: slug ownership, tenant mapping                        │   │
│  │  page_views: analytics (append-only, partitioned)                │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Retention and Lifecycle

```
RETENTION POLICY:

  Published versions (R2 files):
  ├── Current live version:     Retained indefinitely
  ├── Previous 9 versions:      Retained for rollback (configurable)
  └── Versions older than 10:   Deleted after 7 days by lifecycle rule

  User media (R2):
  ├── Active project media:     Retained while project exists
  ├── Archived project media:   Retained 90 days after archive, then deleted
  └── Orphaned media:           Media with no project reference
                                 Flagged by daily batch job
                                 Deleted after 30 days

  Template assets (R2):
  ├── Current version assets:   Retained indefinitely
  └── Old version assets:       Retained while any project references that version

  KV routing entries:
  ├── Active projects:          Retained indefinitely
  ├── Archived projects:        Deleted immediately (site goes offline)
  └── Unpublished projects:     No KV entry exists

  Build artifacts on failed builds:
  └── Cleaned by daily lifecycle job: delete R2 prefixes where
      published_versions.status = 'failed' AND created_at < now() - 24h
```

### 2.3 Storage Size Estimates

```
PER-PROJECT STORAGE (single published version):

  Component                  Size           Notes
  ──────────────────────────────────────────────────────
  index.html                 15-50KB        After minification
  CSS (all)                  10-30KB        After dedup + minification
  JS (islands, shared)       15-25KB        After tree-shake + minify
  Build manifest             1-2KB          JSON metadata
  ──────────────────────────────────────────────────────
  Code subtotal              ~41-107KB      ~75KB average

  User images (in assets/)   200KB-5MB      Depends on photo count + quality
  Template decorative assets Shared (0KB per project, stored once)
  ──────────────────────────────────────────────────────
  Total per version          ~300KB - 5MB   ~1.5MB average

  With 10 retained versions: ~15MB per project average

AT SCALE (100k projects, 60% published):

  Published projects:        60,000
  Average versions retained: 5
  Average per version:       1.5MB
  ──────────────────────────────────────────────────────
  Published files:           60,000 × 5 × 1.5MB = 450GB
  User media (all):          60,000 × 300MB avg = 18TB
  Template assets:           500 templates × 2MB = 1GB
  Shared vendor/islands:     ~50MB (deduplicated)
  ──────────────────────────────────────────────────────
  Total R2 storage:          ~18.5TB
```

---

## 3. CDN Strategy

### 3.1 CDN Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CDN SERVING ARCHITECTURE                             │
│                                                                         │
│  VISITOR REQUEST                                                        │
│  https://sarah-james.elove.me/                                         │
│  https://wedding.smith.com/                                             │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  CLOUDFLARE EDGE (nearest PoP, 330+ cities)                      │  │
│  │                                                                   │  │
│  │  Layer 1: CDN Cache                                              │  │
│  │  ─────────────────                                               │  │
│  │  Cache key: {hostname}:{pathname}:{accept-encoding}              │  │
│  │                                                                   │  │
│  │  HIT?  → Return cached response immediately (<10ms)              │  │
│  │  MISS? → Pass to Worker                                          │  │
│  │                                                                   │  │
│  └──────────────┬───────────────────────────────────────────────────┘  │
│                 │ CACHE MISS                                            │
│                 ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  CLOUDFLARE WORKER (runs at edge, same PoP)                      │  │
│  │                                                                   │  │
│  │  1. RESOLVE HOSTNAME                                             │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  hostname = request.headers.get("host")      │              │  │
│  │     │                                              │              │  │
│  │     │  if hostname ends with ".elove.me":          │              │  │
│  │     │    slug = hostname.split(".")[0]              │              │  │
│  │     │  else:                                       │              │  │
│  │     │    // custom domain                          │              │  │
│  │     │    domainEntry = KV.get("domain:{hostname}") │              │  │
│  │     │    if (!domainEntry) → return 404 page       │              │  │
│  │     │    slug = domainEntry.slug                   │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  2. LOAD ROUTING CONFIG                                          │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  routeConfig = KV.get("slug:{slug}")         │              │  │
│  │     │  if (!routeConfig) → return 404 page         │              │  │
│  │     │                                              │              │  │
│  │     │  { r2Prefix, buildHash, planTier,            │              │  │
│  │     │    passwordHash, publishedAt }               │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  3. PASSWORD GATE (if enabled)                                   │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  if (routeConfig.passwordHash):              │              │  │
│  │     │    cookie = request.cookies.get("elove_pw")  │              │  │
│  │     │    if (!cookie || !verify(cookie, hash)):    │              │  │
│  │     │      → return password entry HTML page       │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  4. RESOLVE FILE PATH                                            │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  pathname = new URL(request.url).pathname    │              │  │
│  │     │  if (pathname === "/" || pathname === "")     │              │  │
│  │     │    pathname = "/index.html"                  │              │  │
│  │     │                                              │              │  │
│  │     │  r2Key = r2Prefix + pathname.slice(1)        │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  5. FETCH FROM R2                                                │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  object = R2.get(r2Key)                      │              │  │
│  │     │  if (!object) → return 404 page              │              │  │
│  │     │                                              │              │  │
│  │     │  response = new Response(object.body, {      │              │  │
│  │     │    headers: buildHeaders(pathname, object)    │              │  │
│  │     │  })                                          │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  6. INJECT BRANDING (free plan only)                             │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  if (planTier === "free" &&                  │              │  │
│  │     │      pathname === "/index.html"):            │              │  │
│  │     │    response = HTMLRewriter()                 │              │  │
│  │     │      .on("body", {                          │              │  │
│  │     │        element(el) {                        │              │  │
│  │     │          el.append(BRANDING_BADGE_HTML,      │              │  │
│  │     │                    { html: true })           │              │  │
│  │     │        }                                    │              │  │
│  │     │      })                                     │              │  │
│  │     │      .transform(response)                   │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  7. ANALYTICS BEACON (all plans)                                 │  │
│  │     ┌─────────────────────────────────────────────┐              │  │
│  │     │  if (pathname === "/index.html"):            │              │  │
│  │     │    // Fire-and-forget: don't block response  │              │  │
│  │     │    ctx.waitUntil(                            │              │  │
│  │     │      logPageView({                          │              │  │
│  │     │        projectId: routeConfig.projectId,     │              │  │
│  │     │        country: request.cf.country,          │              │  │
│  │     │        device: parseUserAgent(request),      │              │  │
│  │     │        referrer: request.headers.referrer,   │              │  │
│  │     │        timestamp: Date.now()                │              │  │
│  │     │      })                                     │              │  │
│  │     │    )                                        │              │  │
│  │     └─────────────────────────────────────────────┘              │  │
│  │                                                                   │  │
│  │  8. RETURN RESPONSE                                              │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cache Headers Strategy

```
FILE PATTERN                  CACHE-CONTROL                    RATIONALE
─────────────────────────────────────────────────────────────────────────────
*.{hash}.css                  public, max-age=31536000,        Content-addressed.
*.{hash}.js                   immutable                        Hash changes on every
*.{hash}.webp                                                  content change.
*.{hash}.woff2                                                 NEVER needs purging.

index.html                    public, max-age=0,               Always revalidate.
                              s-maxage=3600,                   CDN caches 1 hour.
                              stale-while-revalidate=86400     Serve stale while
                                                               fetching fresh in
                                                               background (24h).

manifest.json                 public, max-age=0,               Same as index.html.
                              s-maxage=3600

/shared/vendor/*.js           public, max-age=31536000,        GSAP and shared libs.
                              immutable                        Version in filename.

/shared/islands/*.{hash}.js   public, max-age=31536000,        Shared island scripts.
                              immutable                        Hash ensures freshness.
```

### 3.3 Cache Invalidation

```
INVALIDATION STRATEGY:

  ON PUBLISH:
  1. New version gets new R2 prefix → all hashed assets are new URLs
     → No invalidation needed for CSS/JS/images (new URLs, old ones untouched)

  2. index.html at old prefix still in CDN cache:
     → Call Cloudflare API: POST /zones/{zoneId}/purge_cache
       Body: { files: [
         "https://{slug}.elove.me/",
         "https://{slug}.elove.me/index.html",
         "https://{customDomain}/"          // if custom domain exists
         "https://{customDomain}/index.html"
       ]}
     → Purge completes in <5 seconds globally

  3. But KV propagation takes ~60 seconds globally:
     → Race condition: CDN purges index.html, new request hits Worker,
        Worker reads new KV routing → serves new version. Correct.
     → Edge case: CDN purges, but KV hasn't propagated at this PoP yet
        → Worker reads old KV, serves old version from old R2 prefix
        → Self-corrects within 60 seconds when KV propagates
        → Acceptable for wedding sites (not stock trading)

  4. stale-while-revalidate on index.html provides additional protection:
     → Even if purge hasn't reached a PoP, the next request will
        get the stale version while fetching fresh in background.
     → Second request (seconds later) gets fresh version.

  INVALIDATION BUDGET:
  Cloudflare free plan: 1,000 purge requests per day
  At 500 publishes/day: 2 purge calls per publish = 1,000. Tight.
  → Cloudflare Pro plan ($20/zone/mo) bumps to 500,000/day. Required at scale.
  → Or: batch purges with "purge everything" once per minute (loses precision
     but stays within free limits). NOT recommended — purges ALL sites.
  → Best: use "purge by prefix" (Enterprise) or cache tags (Enterprise).
  → Practical path: Cloudflare Pro plan at $20/mo covers this until Enterprise.
```

### 3.4 Analytics Collection

```
PAGE VIEW TRACKING FLOW:

  Worker fires ctx.waitUntil(logPageView(...))
    → Does NOT block the response to the visitor
    → logPageView sends event to:

  OPTION A: Cloudflare Analytics Engine (recommended)
    → Native integration, no external dependency
    → Supports blobs (strings) and doubles (numbers)
    → Queryable via GraphQL API
    → $0.25 per million data points
    → Auto-samples at high volume

  OPTION B: Worker → Cloudflare Logpush → ClickHouse / Tinybird
    → Higher fidelity (no sampling)
    → Higher cost and complexity
    → Use when advanced analytics tier demands exact counts

  CHOSEN: Option A for basic plan, Option B added for advanced plan.

  DATA POINT STRUCTURE (Analytics Engine):
  {
    blobs: [
      projectId,          // blob1: which wedding site
      country,            // blob2: visitor's country (from request.cf)
      deviceType,         // blob3: "mobile" | "desktop" | "tablet"
      referrer,           // blob4: referral source domain
      pageSlug            // blob5: which page within the site
    ],
    doubles: [
      1,                  // double1: always 1 (count)
      Date.now()          // double2: timestamp
    ],
    indexes: [
      projectId           // for filtering by project
    ]
  }

  VISITOR DEDUP:
  → Hash IP + User-Agent + date into anonymous visitor ID
  → Store in Analytics Engine blob6
  → Query unique visitors: COUNT(DISTINCT blob6)
  → No cookies. No tracking scripts. No GDPR consent needed.
  → Compliant: we never store IP addresses, only a one-way hash
    that changes daily (includes date in hash input)

  DASHBOARD QUERIES (via GraphQL → Analytics Engine):
  → Total views by date range
  → Unique visitors by date range
  → Top referrers
  → Device breakdown (mobile vs desktop)
  → Country distribution
  → Page-level breakdown (home vs rsvp vs gallery)
```

---

## 4. Domain Routing Strategy

### 4.1 Three Hostname Types

```
TYPE 1: SUBDOMAIN (*.elove.me)
─────────────────────────────────────────
  DNS: Wildcard A/AAAA record pointing to Cloudflare
       *.elove.me → Cloudflare Proxy

  Worker routing:
  1. Extract slug from hostname: "sarah-james.elove.me" → "sarah-james"
  2. KV.get("slug:sarah-james") → routing config
  3. Serve from R2

  SSL: Covered by Cloudflare Universal SSL (free, automatic for *.elove.me)
  Setup time: Instant (slug becomes live on publish)
  Cost: $0 additional


TYPE 2: CUSTOM DOMAIN (CNAME to proxy)
─────────────────────────────────────────
  DNS (user configures):
  CNAME wedding.smith.com → sites.elove.me     (or A record → specific IP)

  Worker routing:
  1. Hostname is "wedding.smith.com"
  2. Not a *.elove.me subdomain → custom domain lookup
  3. KV.get("domain:wedding.smith.com") → { slug: "sarah-james" }
  4. KV.get("slug:sarah-james") → routing config
  5. Serve from R2

  SSL: Cloudflare for SaaS (see §5)
  Setup time: 5-30 minutes (DNS propagation + SSL issuance)
  Cost: $0.10/month per custom hostname (Cloudflare for SaaS pricing)


TYPE 3: APEX DOMAIN (root domain, e.g., smith-wedding.com)
─────────────────────────────────────────
  Challenge: Apex domains cannot use CNAME records (RFC constraint).
  Solution: Cloudflare for SaaS supports A records via Anycast IPs.

  DNS (user configures):
  A smith-wedding.com → Cloudflare Anycast IP (provided during setup)
  (Some registrars support ALIAS/ANAME records → use CNAME target instead)

  Worker routing: Same as Type 2 (KV domain→slug→routing)
  SSL: Cloudflare for SaaS (same as Type 2)
  Setup time: 5-60 minutes (apex DNS can take longer to propagate)
  Cost: Same as Type 2 ($0.10/month per hostname)
```

### 4.2 Slug Reservation and Validation

```
SLUG RULES:

  Format:    [a-z0-9]([a-z0-9-]*[a-z0-9])?
  Min:       3 characters
  Max:       63 characters (DNS label limit)
  Reserved:  www, app, api, admin, dashboard, help, support, blog,
             status, docs, cdn, mail, smtp, ftp, ns1, ns2, dev,
             staging, test, demo, preview, assets, static, media,
             upload, webhook, stripe, auth, login, signup, rsvp

  Uniqueness: UNIQUE constraint on projects(tenant_id, slug)
              Globally unique across all tenants (since slug.elove.me
              is a global namespace)
              → Actually: slug must be unique across ALL tenants,
                not just within one tenant. Use separate slug_registry table:

  TABLE: slug_registry
    slug:       TEXT PRIMARY KEY
    project_id: UUID (FK → projects)
    reserved_at: TIMESTAMPTZ

  On project creation:
    1. Validate slug format
    2. Check slug_registry: is it taken?
    3. If available: INSERT into slug_registry + create project
    4. If taken: suggest alternatives (append number, rearrange names)

  On project deletion:
    1. Delete from slug_registry
    2. Delete from KV (if published)
    3. Slug becomes available for reuse (no cooling period — wedding
       sites have short lifecycles, don't need squatting protection)
```

### 4.3 Custom Domain Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│              CUSTOM DOMAIN STATE MACHINE                              │
│                                                                      │
│  ┌───────────┐                                                       │
│  │  PENDING   │ ← User submits domain, CF for SaaS API called       │
│  │  SETUP     │   Show DNS records user must add                     │
│  └─────┬─────┘                                                       │
│        │                                                             │
│        │ DNS records propagated                                      │
│        │ (checked by CF webhook or 5-min polling)                    │
│        ▼                                                             │
│  ┌───────────┐                                                       │
│  │  DNS       │ ← DNS verified, SSL certificate being issued         │
│  │  VERIFIED  │   (Let's Encrypt via Cloudflare)                     │
│  └─────┬─────┘                                                       │
│        │                                                             │
│        │ SSL certificate issued (typically <5 minutes)               │
│        ▼                                                             │
│  ┌───────────┐                                                       │
│  │  ACTIVE    │ ← Domain is live. KV entry created.                  │
│  │           │   custom_domains.ssl_status = 'active'                │
│  └─────┬─────┘                                                       │
│        │                                                             │
│   ┌────┴────┐                                                        │
│   │         │                                                        │
│   │    DNS removed by user (detected by CF health check)             │
│   │         │                                                        │
│   │         ▼                                                        │
│   │   ┌───────────┐                                                  │
│   │   │  DEGRADED  │ ← DNS no longer pointing to CF.                 │
│   │   │            │   SSL renewal will fail.                        │
│   │   │            │   Site still serves from subdomain.              │
│   │   │            │   Email user: "Your domain is disconnected"     │
│   │   └─────┬─────┘                                                  │
│   │         │                                                        │
│   │         │ 7 days with no DNS fix                                 │
│   │         ▼                                                        │
│   │   ┌───────────┐                                                  │
│   │   │  EXPIRED   │ ← Domain record deactivated.                    │
│   │   │            │   KV domain entry deleted.                      │
│   │   │            │   CF hostname removed.                          │
│   │   │            │   User can re-add later.                        │
│   │   └───────────┘                                                  │
│   │                                                                  │
│   │  User removes domain (explicit)                                  │
│   ▼                                                                  │
│  ┌───────────┐                                                       │
│  │  REMOVED   │ ← Clean removal: delete KV, delete CF hostname,     │
│  │            │   delete custom_domains row, subdomain still works   │
│  └───────────┘                                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. SSL Automation Approach

### 5.1 SSL Architecture

```
THREE SSL SCOPES:

SCOPE 1: *.elove.me (platform subdomains)
──────────────────────────────────────────
  Provider:      Cloudflare Universal SSL (included free)
  Certificate:   Wildcard for *.elove.me
  Issuance:      Automatic, managed entirely by Cloudflare
  Renewal:       Automatic, 90-day cycle
  Our effort:    Zero. This just works.

SCOPE 2: Custom domains (e.g., wedding.smith.com)
──────────────────────────────────────────
  Provider:      Cloudflare for SaaS (SSL for SaaS)
  Certificate:   Individual DV (Domain Validated) cert per hostname
  Issuance:      Automatic via Let's Encrypt when DCV passes
  DCV method:    HTTP-01 (via CF proxy) or CNAME (TXT record)
  Renewal:       Automatic, managed by Cloudflare
  Our effort:    API call to create custom hostname → CF handles the rest

  FLOW:
  1. API: POST /zones/{zone}/custom_hostnames
     Body: {
       hostname: "wedding.smith.com",
       ssl: {
         method: "http",
         type: "dv",
         settings: {
           http2: "on",
           min_tls_version: "1.2",
           tls_1_3: "on"
         }
       }
     }
  2. CF returns: ssl.status = "pending_validation"
  3. User adds CNAME → CF detects traffic through proxy
  4. CF issues cert: ssl.status = "active"
  5. We poll or receive webhook for status updates

SCOPE 3: Apex custom domains (e.g., smith-wedding.com)
──────────────────────────────────────────
  Same as Scope 2, but DCV requires either:
  - A record pointing to CF Anycast (HTTP-01 validation)
  - TXT record for DNS-01 validation
  Both handled by Cloudflare for SaaS automatically.
```

### 5.2 SSL Failure Handling

```
FAILURE MODE                    DETECTION              RECOVERY
────────────────────────────────────────────────────────────────────
DNS not pointing to CF          CF hostname status:    Show banner in dashboard:
                                "pending_validation"   "Add this DNS record to
                                for >24 hours          activate your domain"

SSL issuance timeout            CF hostname status:    Retry: DELETE + re-POST
                                "pending_issuance"     the custom hostname
                                for >1 hour            (triggers fresh cert request)

SSL renewal failure             CF webhook:            Email user: "Your domain's
                                ssl.status changed     SSL certificate is expiring.
                                to "pending_renewal"   Please verify your DNS records."
                                for >7 days            Auto-retry daily.

CAA record blocking LE          CF returns error:      Show user: "Your domain has
                                "caa_error"            a CAA record that blocks our
                                                       SSL provider. Add this CAA
                                                       record: 0 issue letsencrypt.org"

Rate limit hit (LE)             CF returns error:      Queue and retry after 1 hour.
                                "too_many_attempts"    Alert ops if persistent.
                                                       Rare: LE rate limit is
                                                       50 certs/domain/week.
```

---

## 6. Cost Estimation Model

### 6.1 Infrastructure Cost Breakdown

```
SCENARIO: 100k registered users, 60k published projects, 1M monthly page views

┌──────────────────────────────────────────────────────────────────────────┐
│  COMPONENT              UNIT COST              MONTHLY EST    NOTES     │
│                                                                         │
│  CLOUDFLARE                                                             │
│  ──────────                                                             │
│  Workers                $0.50/M requests       $1.50          3M req    │
│                         + $0.15/M CPU-ms                      (views +  │
│                                                               assets +  │
│                                                               API edge) │
│  Workers Paid plan      $5/mo flat             $5.00          Required  │
│                                                               for KV +  │
│                                                               R2 binding│
│  KV                     $0.50/M reads          $1.50          3M reads  │
│                         $5.00/M writes         $0.15          30k writes│
│                         $0.50/GB stored         $0.01          ~10MB     │
│  R2 Storage             $0.015/GB/mo           $277.50        18.5TB    │
│  R2 Operations          $0.36/M Class A        $1.80          5M PUTs  │
│                         $0.36/M Class B        $1.08          3M GETs  │
│                         (reads through Worker                           │
│                          are FREE — $0.00)                              │
│  R2 Egress              $0.00                  $0.00          FREE!     │
│  CF Pro plan (DNS zone) $20/mo                 $20.00         For purge │
│                                                               limits    │
│  CF for SaaS hostnames  $0.10/hostname/mo      $200.00        2k custom │
│                                                               domains   │
│  Analytics Engine       $0.25/M data points    $0.25          1M views  │
│  ──────────────────────────────────────────────────────────────────────  │
│  CLOUDFLARE SUBTOTAL                           ~$309/mo                 │
│                                                                         │
│                                                                         │
│  COMPUTE                                                                │
│  ───────                                                                │
│  API Server (Vercel)    Pro plan               $20.00                   │
│                         + serverless functions  ~$10.00        API calls │
│  Render Workers         Fly.io / Railway       $50.00         2-4       │
│                         2 always-on +                         machines  │
│                         auto-scale to 8                       at peak   │
│  ──────────────────────────────────────────────────────────────────────  │
│  COMPUTE SUBTOTAL                              ~$80/mo                  │
│                                                                         │
│                                                                         │
│  DATABASE                                                               │
│  ────────                                                               │
│  PostgreSQL (Neon)      Pro plan               $69.00         Branching │
│                                                               + auto-   │
│                                                               scale     │
│  Redis (Upstash)        Pay-per-request        $20.00         Queue +   │
│                                                               cache     │
│  ──────────────────────────────────────────────────────────────────────  │
│  DATABASE SUBTOTAL                             ~$89/mo                  │
│                                                                         │
│                                                                         │
│  THIRD PARTY                                                            │
│  ───────────                                                            │
│  Stripe                 2.9% + $0.30/txn       Variable       ~2.9% rev│
│  Clerk (Auth)           Pro plan               $25.00         Up to 10k│
│                                                               MAU      │
│  Resend (Email)         Pro plan               $20.00         Transact │
│  Sentry (Monitoring)    Team plan              $26.00                   │
│  GSAP Business license  $199/year              $16.60/mo               │
│  ──────────────────────────────────────────────────────────────────────  │
│  THIRD PARTY SUBTOTAL                          ~$88/mo + Stripe        │
│                                                                         │
│                                                                         │
│  ══════════════════════════════════════════════════════════════════════  │
│  TOTAL INFRASTRUCTURE                          ~$566/mo                 │
│  (excluding Stripe transaction fees)                                    │
│  ══════════════════════════════════════════════════════════════════════  │
│                                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Cost per Unit Economics

```
AT 100K USERS, 60K PUBLISHED PROJECTS:

  Infra cost:               $566/mo
  Cost per published site:  $566 / 60,000 = $0.0094/site/mo  (~1 cent)
  Cost per page view:       $566 / 1,000,000 = $0.00057/view

  REVENUE MODEL (assuming 10% paid conversion):
  Free:       90,000 users × $0/mo     =  $0
  Starter:    6,000 users × $9/mo      =  $54,000/mo
  Pro:        3,000 users × $19/mo     =  $57,000/mo
  Business:   1,000 users × $39/mo     =  $39,000/mo
  ──────────────────────────────────────────────────
  GROSS REVENUE:                          $150,000/mo
  INFRA COST:                             $566/mo
  GROSS MARGIN:                           99.6%

  The key insight: R2's zero egress makes this business model work.
  On AWS S3 + CloudFront, the same 18.5TB storage with 1M views
  would cost ~$1,700/mo in egress alone (at $0.085/GB outbound).
```

### 6.3 Cost Scaling Curves

```
USERS     PUBLISHED   MONTHLY     R2 STORAGE   INFRA COST    COST/SITE
          PROJECTS    PAGE VIEWS
──────────────────────────────────────────────────────────────────────
1k        500         10k         100GB        $50/mo        $0.10
10k       5,000       100k        1.8TB        $120/mo       $0.024
50k       30,000      500k        9TB          $280/mo       $0.009
100k      60,000      1M          18.5TB       $566/mo       $0.009
500k      300,000     5M          90TB         $2,100/mo     $0.007
1M        600,000     10M         180TB        $4,000/mo     $0.007

Note: Cost per site DECREASES with scale due to:
- Fixed costs (Vercel, Neon, Clerk) spread across more users
- R2 storage cost is linear but egress remains $0
- KV reads scale linearly but cost is trivial ($0.50/M)
- Render workers scale with PUBLISHES (not views), which is bursty
  but bounded (average user publishes 2-3 times total)
```

---

## 7. Failure Recovery Strategy

### 7.1 Failure Taxonomy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      FAILURE MODE CATALOG                                │
│                                                                         │
│  CATEGORY 1: BUILD FAILURES (during render pipeline)                    │
│  ───────────────────────────────────────────────────                    │
│                                                                         │
│  F1.1: Template render crash                                            │
│  Cause:     Malformed scene_graph, division by zero in layout calc,     │
│             missing component in registry                               │
│  Detection: Worker process uncaught exception                           │
│  Impact:    Single project. Build fails. Previous version stays live.   │
│  Recovery:  published_versions.status → 'failed'                        │
│             published_versions.build_error → stack trace (sanitized)     │
│             Client shows: "Build failed. We're looking into it."        │
│             Alert ops. User can retry.                                  │
│  Prevention: Publish-gate validation catches most. Sandboxed build      │
│              with timeout catches the rest.                              │
│                                                                         │
│  F1.2: Worker OOM (out of memory)                                       │
│  Cause:     Extremely large project (500 images, 30 sections)           │
│  Detection: Worker process killed by OS (exit code 137)                 │
│  Impact:    Single project. Build fails.                                │
│  Recovery:  Same as F1.1. Additionally: log project complexity metrics  │
│             to identify pathological templates needing optimization.     │
│  Prevention: Document size limit (2MB JSON). Image count limit (100).   │
│              Render worker memory: 2GB minimum.                         │
│                                                                         │
│  F1.3: Worker crash loop                                                │
│  Cause:     Bug in render pipeline affecting all builds                 │
│  Detection: Dead-letter queue depth > 10 within 5 minutes               │
│  Impact:    ALL publishes fail. Existing live sites unaffected.          │
│  Recovery:  PagerDuty alert → on-call engineer.                         │
│             Rollback render worker to previous known-good version.       │
│             Replay DLQ messages after fix.                               │
│  Prevention: Canary deploys for render worker updates.                  │
│              Deploy to 1 worker first, verify 10 builds pass,           │
│              then roll out to all workers.                               │
│                                                                         │
│                                                                         │
│  CATEGORY 2: DEPLOY FAILURES (R2 upload or KV update)                   │
│  ─────────────────────────────────────────────────────                  │
│                                                                         │
│  F2.1: R2 upload partial failure                                        │
│  Cause:     Network timeout during parallel upload (1 of 50 files)      │
│  Detection: Upload checksum verification fails                          │
│  Impact:    Build artifacts incomplete. Cannot go live.                  │
│  Recovery:  Retry failed file uploads (3 attempts with backoff).        │
│             If still failing: mark build as 'failed'.                   │
│             Previous version stays live.                                │
│  Prevention: Retry logic built into upload step. Checksums for every    │
│              file against build manifest.                                │
│                                                                         │
│  F2.2: KV write failure                                                 │
│  Cause:     Cloudflare KV API temporary outage                          │
│  Detection: KV.put() returns error                                      │
│  Impact:    Files uploaded to R2 but routing not updated.               │
│             Previous version stays live. No data loss.                  │
│  Recovery:  Retry KV write 5x with exponential backoff (1s → 32s).     │
│             If all fail: mark status as 'deploy_pending'.              │
│             Background cron retries every 5 minutes.                    │
│             Alert ops after 30 minutes.                                  │
│  Prevention: KV has 99.99% availability SLA. Rare.                     │
│                                                                         │
│  F2.3: CDN purge failure                                                │
│  Cause:     Cloudflare API rate limit or outage                         │
│  Detection: Purge API returns 429 or 5xx                                │
│  Impact:    New version is live in R2 + KV, but some edge PoPs serve   │
│             cached old index.html until cache TTL expires (1 hour).     │
│  Recovery:  Retry purge with backoff. If fails: cache expires in 1h.   │
│             User's site is at most 1 hour stale. Acceptable for         │
│             wedding invitations.                                        │
│  Prevention: stale-while-revalidate header ensures visitors get a       │
│              response (possibly stale) regardless of purge status.       │
│                                                                         │
│                                                                         │
│  CATEGORY 3: SERVING FAILURES (visitor-facing)                          │
│  ──────────────────────────────────────────────                         │
│                                                                         │
│  F3.1: R2 read failure                                                  │
│  Cause:     R2 regional outage (extremely rare)                         │
│  Detection: R2.get() returns null for a key that should exist           │
│  Impact:    Visitors see error page instead of wedding site             │
│  Recovery:  Worker returns custom 503 page:                             │
│             "This site is temporarily unavailable. Please try again     │
│              in a few minutes."                                         │
│             The page is hardcoded in the Worker (no R2 dependency).     │
│             Alert ops. R2 outages typically resolve in <15 minutes.     │
│  Prevention: R2 has 99.999999999% (11 nines) durability.               │
│              Availability is 99.9% SLA. Outages are exceedingly rare.  │
│                                                                         │
│  F3.2: KV read failure                                                  │
│  Cause:     KV namespace unavailable                                    │
│  Detection: KV.get() returns null or throws                             │
│  Impact:    Cannot resolve slug → R2 prefix. All sites affected.        │
│  Recovery:  Worker falls back to direct R2 listing:                     │
│             List R2 objects with prefix "published/" + slug + "/",      │
│             find latest version directory.                              │
│             Slower (~200ms vs ~1ms) but functional.                     │
│             Cache the result in Worker memory for 5 minutes.            │
│  Prevention: KV is eventually consistent and globally distributed.      │
│              Total outage is essentially impossible. Partial PoP         │
│              outage handled by CF automatic failover to nearest PoP.    │
│                                                                         │
│  F3.3: Worker crash                                                     │
│  Cause:     Bug in Worker code, uncaught exception                      │
│  Detection: Cloudflare returns 1101 error to visitor                    │
│  Impact:    All sites served by that Worker version are affected.       │
│  Recovery:  Cloudflare automatically retries on different isolate.      │
│             If persistent: rollback Worker to previous version via       │
│             Wrangler CLI or CF dashboard (takes ~30 seconds global).    │
│  Prevention: Worker code is <500 lines. Thoroughly tested.              │
│              Canary deploy: new Worker version to 1% traffic first.     │
│                                                                         │
│                                                                         │
│  CATEGORY 4: DATA FAILURES                                              │
│  ─────────────────────────                                              │
│                                                                         │
│  F4.1: PostgreSQL outage                                                │
│  Cause:     Neon/Supabase service disruption                            │
│  Detection: API health check fails                                      │
│  Impact:    Cannot publish (validation requires DB reads).              │
│             Cannot edit (autosave requires DB writes).                   │
│             Live sites UNAFFECTED (served entirely from R2 + KV).      │
│  Recovery:  API returns 503 for publish/edit operations.                │
│             Editor enters "offline mode" (IndexedDB preserves edits).   │
│             Live sites continue serving. No visitor impact.             │
│  Prevention: Neon auto-replication. Daily logical backups to R2.        │
│              RTO: <15 minutes (Neon restore). RPO: <1 minute.          │
│                                                                         │
│  F4.2: Redis (Upstash) outage                                          │
│  Cause:     Upstash service disruption                                  │
│  Detection: Queue operations fail                                       │
│  Impact:    Publish queue stalls. New builds don't start.               │
│             Live sites UNAFFECTED.                                       │
│  Recovery:  Fall back to synchronous build (process in API server).     │
│             Slower but functional. Re-queue buffered builds when         │
│             Redis recovers.                                             │
│  Prevention: Upstash provides multi-region replication.                 │
│              99.99% availability SLA.                                    │
│                                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Rollback Procedures

```
ROLLBACK TYPE          TRIGGER                    PROCEDURE
──────────────────────────────────────────────────────────────────────────

User-initiated         User clicks "Rollback"     1. Verify target version exists
rollback               in publish history         2. KV.put("slug:{slug}") with
                                                     target version's R2 prefix
                                                  3. Purge CDN cache for index.html
                                                  4. Update published_versions:
                                                     current → 'rolled_back'
                                                     target → 'live'
                                                  5. Time: <10 seconds

Bad deploy             Ops detects broken site    Same as user-initiated but
auto-rollback          via synthetic monitoring   triggered by alerting system.
                       (Lighthouse CI check       Automatic if post-deploy
                       fails on published URL)    Lighthouse score drops >20 points
                                                  from previous version.

Render worker          DLQ depth > 10 in 5min     1. Rollback Worker deployment
rollback                                            to previous tag via Wrangler
                                                  2. Replay DLQ messages
                                                  3. Verify builds succeed

Worker code            1101 error rate > 1%       1. wrangler rollback (CF CLI)
rollback               across all sites for       2. Immediate global rollback
                       2+ minutes                 3. Takes ~30 seconds
```

---

## 8. Scaling to 1M Monthly Visits

### 8.1 Traffic Model

```
1M MONTHLY PAGE VIEWS DECOMPOSITION:

  Assumption: 60,000 published projects, average ~17 views/project/month
  (Wedding sites are bursty: high traffic when invitations sent, low otherwise)

  Traffic pattern:
  ├── Daily average:    ~33,000 views/day
  ├── Peak day:         ~100,000 views/day (wedding season Saturday)
  ├── Peak hour:        ~20,000 views/hour
  ├── Peak minute:      ~500 views/minute
  └── Peak second:      ~15 requests/second

  This is LOW traffic for a CDN. Cloudflare handles 50M+ requests/second
  across its network. Our entire platform's peak is a rounding error.

  REQUEST BREAKDOWN (per page view):
  ├── 1× index.html                          (Worker + R2 or cache)
  ├── 1× style.{hash}.css                    (cached immutable)
  ├── 1× shared.{hash}.js                    (cached immutable)
  ├── 0-3× island scripts                    (cached immutable)
  ├── 1× GSAP from CDN                       (cached from cdnjs)
  ├── 1-5× images                            (cached immutable)
  ├── 1-2× font files                        (cached from Google Fonts)
  └── 0-1× Lottie JSON                       (cached immutable)
  ───────────────────────────────────────────────
  Total HTTP requests per view: ~6-14
  Total requests/month: 1M × 10 avg = ~10M HTTP requests

  CDN cache hit ratio estimate:
  ├── Hashed assets: 99%+ hit rate (immutable, 1-year TTL)
  ├── index.html: ~80% hit rate (1-hour s-maxage + stale-while-revalidate)
  ├── External (GSAP, fonts): 99%+ (global CDN cache)
  └── Overall: ~95% cache hit rate

  Worker invocations: ~500k/month (5% cache miss × 10M requests)
  R2 reads (through Worker): ~500k/month
  R2 reads (direct cache fill): effectively zero (Workers handle R2 reads)
```

### 8.2 Bottleneck Analysis at 1M Views

```
COMPONENT            CAPACITY         AT 1M VIEWS/MO    HEADROOM    BOTTLENECK?
──────────────────────────────────────────────────────────────────────────────
CF Worker            10M req/mo       500k req/mo        20×         No
                     (paid plan)      (cache misses)

CF KV reads          Unlimited        500k reads/mo      ∞           No
                     (eventually
                      consistent)

R2 reads             Unlimited        500k reads/mo      ∞           No
                     (via Worker)     (Worker-mediated)

R2 storage           Unlimited        18.5TB             ∞           No
                                                         (cost-bound
                                                          not capacity)

PostgreSQL           10k conn/s       ~50 queries/s      200×        No
(Neon Pro)           (pooled)         (API, not serving)

Redis (Upstash)      100k req/s       ~100 req/s         1000×       No
                                      (queue + cache)

Render workers       ~4 builds/min    ~200 builds/day    28×         No
(2 workers)          per worker       (peak day)
                     = 5,760/day

Analytics Engine     Unlimited        1M data points/mo  ∞           No
                     (CF managed)

API Server           1M req/mo        ~500k req/mo       2×          WATCH
(Vercel Pro)         (before edge     (editor + API)
                      caching)
──────────────────────────────────────────────────────────────────────────────

VERDICT: At 1M monthly views, nothing is close to bottleneck.
         The first constraint hit will be Vercel function invocations
         for the editor/API (not for serving — that's fully on CF).
         Solution: add Redis cache layer for hot API paths (already planned).
```

### 8.3 Scaling Milestones

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     SCALING MILESTONE MAP                                │
│                                                                         │
│  MILESTONE 1: 1M views/month (current design)                          │
│  ─────────────────────────────────────────────                          │
│  Infrastructure: Current architecture is sufficient.                     │
│  Changes needed: None.                                                  │
│  Cost: ~$566/mo                                                         │
│                                                                         │
│                                                                         │
│  MILESTONE 2: 10M views/month                                           │
│  ─────────────────────────────                                          │
│  What changes:                                                          │
│  ├── API: Add Redis cache for project metadata (reduce DB reads 80%)   │
│  ├── Analytics: Migrate from CF Analytics Engine to Tinybird            │
│  │   (Analytics Engine samples at high volume; Tinybird gives exact)    │
│  ├── Render: Add 2 more workers (4 total) for peak publish load        │
│  ├── DB: Add read replica for analytics queries                        │
│  └── Monitoring: Add synthetic monitoring (Lighthouse CI on sample      │
│      of published sites every hour)                                     │
│  Cost: ~$1,200/mo                                                       │
│                                                                         │
│                                                                         │
│  MILESTONE 3: 100M views/month                                          │
│  ──────────────────────────────                                         │
│  What changes:                                                          │
│  ├── KV: Evaluate Cloudflare D1 (SQL at edge) for complex routing      │
│  │   (KV is key-value only; D1 enables JOIN-like queries at edge)      │
│  ├── Render: Auto-scaling pool (8-20 workers) on Fly.io or Railway     │
│  ├── Media: Dedicated image processing service (separate from API)     │
│  ├── DB: Neon with connection pooling (PgBouncer) for API connections  │
│  ├── DB: Partition page_views by month, add ClickHouse for analytics   │
│  ├── R2: Evaluate multi-bucket strategy (hot vs cold storage)          │
│  │   Active projects in hot bucket, archived in cold                   │
│  └── API: Consider splitting to dedicated server (Railway/Fly)         │
│      if Vercel serverless costs exceed dedicated compute                │
│  Cost: ~$4,000/mo                                                       │
│                                                                         │
│                                                                         │
│  MILESTONE 4: 1B views/month (wedding season viral)                     │
│  ──────────────────────────────────────────────────                     │
│  What changes:                                                          │
│  ├── Move to Cloudflare Enterprise (dedicated account team,            │
│  │   cache reserve, Argo Smart Routing, advanced DDoS)                 │
│  ├── Consider edge-side rendering (Worker generates HTML from          │
│  │   KV-stored JSON, eliminating R2 reads for index.html entirely)    │
│  ├── Render farm: 50+ workers with spot instances (Fly.io Machines)   │
│  ├── DB: Citus or CockroachDB for horizontal write scaling            │
│  ├── Consider pre-rendering popular sites to edge cache (push model   │
│  │   instead of pull model — pre-warm cache before traffic arrives)   │
│  └── Dedicated team for infrastructure (platform engineering hire)     │
│  Cost: ~$15,000-25,000/mo                                               │
│                                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.4 DDoS and Abuse Protection

```
PROTECTION LAYERS:

  Layer 1: Cloudflare (automatic, included)
  ├── L3/L4 DDoS mitigation (BGP anycast absorption)
  ├── L7 DDoS mitigation (rate limiting, challenge pages)
  ├── Bot management (basic, included in Pro plan)
  └── WAF rules (managed ruleset for common attacks)

  Layer 2: Worker-level rate limiting
  ├── RSVP form: 5 submissions per IP per project per hour
  ├── Guestbook: 3 submissions per IP per project per hour
  ├── Password attempts: 10 per IP per project per hour
  └── Implemented via CF Rate Limiting Rules (count by IP)

  Layer 3: Abuse detection (application-level)
  ├── Published site serving suspicious content:
  │   → Automated scan of index.html on publish (DOMPurify + keyword check)
  │   → Report mechanism on every published site (tiny link in footer)
  │   → Manual review queue for reported sites
  ├── Crypto mining scripts in custom JS (if ever allowed):
  │   → CSP blocks all inline and external scripts except allowlist
  │   → Current architecture: NO custom JS allowed. Only island scripts.
  └── SEO spam sites:
      → Monitor for bulk project creation from single tenant
      → Flag accounts creating >10 projects/day for review
      → Block publishing if flagged, pending review

  Estimated DDoS risk: LOW
  Wedding invitation sites are not typical DDoS targets.
  Main risk is accidental viral traffic (invitation goes viral on social media).
  Cloudflare handles this natively — it's literally what CDNs are built for.
```

---

## Appendix: Publishing Engine Decision Log

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| **Object storage** | Cloudflare R2 | AWS S3, Google Cloud Storage, Backblaze B2 | Zero egress cost is the decisive factor. Wedding sites are media-heavy. At 18.5TB storage with S3 egress at $0.085/GB, monthly egress on 1M views with ~500GB outbound would cost ~$42.50. On R2: $0.00. The savings compound at scale. S3-compatible API means migration is trivial if needed. |
| **CDN** | Cloudflare (Workers + KV + R2) | AWS CloudFront + Lambda@Edge, Vercel Edge, Fastly | Tight integration: R2 reads from Workers have zero egress and near-zero latency. KV provides sub-millisecond routing lookups at edge. Cloudflare for SaaS handles custom domains + SSL with a single API call. The entire serving path (DNS → SSL → CDN → routing → storage → analytics) runs on one platform. No cross-vendor latency or auth complexity. |
| **Build queue** | Redis Streams (Upstash) | SQS, RabbitMQ, Inngest, Temporal | Redis Streams provide exactly-once delivery via consumer groups, priority via multiple streams, and dead-letter via XCLAIM timeout. Upstash is serverless (no infra management) and pay-per-request. SQS would work but adds AWS dependency. Temporal is overengineered for a queue-and-process pattern. |
| **Analytics** | CF Analytics Engine (basic) + Tinybird (advanced) | Self-hosted ClickHouse, PostHog, Plausible | CF Analytics Engine is built into Workers — zero additional infra, zero additional latency, $0.25/M events. Good enough for basic plan (total views, top referrers, device split). Tinybird adds exact counts, funnel analysis, and custom queries for advanced plan. Self-hosted ClickHouse is powerful but requires dedicated ops. PostHog/Plausible add client-side JS that increases page weight. |
| **Custom domain SSL** | Cloudflare for SaaS | Let's Encrypt self-managed (Caddy/cert-manager), AWS ACM | CF for SaaS handles the entire lifecycle: DCV, issuance, renewal, revocation — via a single API call per hostname. Self-managing Let's Encrypt means running cert-manager, handling ACME challenges, storing certs, and deploying them to edge — significant operational burden that scales linearly with custom domains. At 2,000 custom domains, CF for SaaS costs $200/mo. A dedicated cert-manager cluster would cost more in compute + engineering time. |
| **Serving model** | Static files from R2 via Worker | SSR (Next.js on Vercel), ISR, edge-side rendering | Static files are the cheapest possible serving model: $0 compute per request. R2 read + Worker overhead is ~$0.0000005 per request. SSR would require a Node.js function invocation per page view ($0.000003/invocation) — 6x more expensive and adds P99 latency. Wedding sites are perfect static candidates: content changes only on republish, not per-request. The 5% of content that's dynamic (RSVP form, guestbook, countdown) is handled by tiny JS islands that call edge functions. |
| **Version retention** | Keep 10 versions per project | Keep all, keep 3, keep only latest | 10 versions provides rollback depth for "oops, the previous version was better" scenarios (common with visual editing). Keeping all versions is wasteful (most versions are never revisited). Keeping only 3 is too aggressive (template update → publish → realize you preferred 4 versions ago). Storage cost for 10 versions is ~15MB per project — trivial. |

---

*End of Publishing Engine Design Document*
