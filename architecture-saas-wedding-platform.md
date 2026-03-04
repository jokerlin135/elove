# SaaS Wedding Invitation Platform — System Architecture Document

**Version:** 1.0
**Date:** March 3, 2026
**Author:** Principal SaaS Architect
**Codename:** ELove Platform

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  Marketing   │  │  Dashboard   │  │  Visual Editor (Canvas)      │  │
│  │  Site (SSG)  │  │  SPA (React) │  │  React + Fabric.js/Konva    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘  │
│         │                 │                          │                   │
└─────────┼─────────────────┼──────────────────────────┼───────────────────┘
          │                 │                          │
          ▼                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (Edge)                               │
│              Cloudflare Workers / Vercel Edge Middleware                 │
│         ┌──────────────────────────────────────────────┐               │
│         │  Rate Limiting · Auth · Tenant Resolution     │               │
│         │  Quota Check · Request Routing                │               │
│         └──────────────────────────────────────────────┘               │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────┐
          ▼                   ▼                        ▼
┌─────────────────┐ ┌─────────────────┐ ┌────────────────────────┐
│  CORE API       │ │  PUBLISH        │ │  MEDIA SERVICE         │
│  (App Server)   │ │  SERVICE        │ │                        │
│                 │ │                 │ │  Upload → Process →    │
│  Auth/Users     │ │  JSON → HTML    │ │  Optimize → Store      │
│  Projects       │ │  Static Build   │ │                        │
│  Templates      │ │  CDN Deploy     │ │  R2/S3 + imgproxy      │
│  Subscriptions  │ │  Domain Mgmt    │ │  or Cloudflare Images  │
│  RSVP/Guestbook │ │                 │ │                        │
└────────┬────────┘ └────────┬────────┘ └───────────┬────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  PostgreSQL   │  │  Redis       │  │  R2 / S3     │  │  KV Store │  │
│  │  (Neon/Supa)  │  │  (Upstash)   │  │  (Objects)   │  │  (Edge)   │  │
│  │              │  │              │  │              │  │           │  │
│  │  Users       │  │  Sessions    │  │  Media       │  │  Publish  │  │
│  │  Projects    │  │  Rate Limits │  │  Templates   │  │  Config   │  │
│  │  Templates   │  │  Pub Queue   │  │  Static      │  │  DNS map  │  │
│  │  Subs/Billing│  │  Cache       │  │  Assets      │  │           │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DELIVERY LAYER                                     │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  CDN (Cloudflare)                                                  │ │
│  │                                                                    │ │
│  │  *.elove.me          → Subdomain routing (KV lookup)              │ │
│  │  custom-domain.com   → CNAME + SSL provisioning (Cloudflare SaaS) │ │
│  │  Static HTML/CSS/JS  → Cached at edge, TTL 1yr (purge on publish) │ │
│  │  Media assets        → R2 served via Workers with transforms      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Subsystem Boundaries

| Subsystem | Responsibility | Boundary Type | Communication |
|-----------|---------------|---------------|---------------|
| **Auth Service** | Registration, login, OAuth, sessions, RBAC | Internal module | Direct function call |
| **Project Service** | CRUD for invitation projects, page/section management | Internal module | Direct function call |
| **Template Service** | Template registry, marketplace listings, versioning | Internal module | Direct function call |
| **Editor Service** | JSON scene graph management, undo/redo, collaboration lock | Client-heavy + API | REST + WebSocket |
| **Render Engine** | JSON → HTML/CSS/JS static output | Isolated worker | Queue-triggered |
| **Publish Service** | Build, deploy to CDN, DNS management, SSL | Isolated worker | Queue-triggered |
| **Media Service** | Upload, validate, resize, optimize, serve | Standalone service | REST API |
| **Billing Service** | Stripe integration, plan management, quota enforcement | Internal module | Webhooks + direct |
| **Analytics Service** | Page views, RSVP counts, visitor geo | Edge + async | Edge log → batch |
| **RSVP/Guestbook** | Guest responses, dietary prefs, attendance | Edge function | Serverless function |

**Boundary Principle:** Services that are latency-sensitive or share transactional data stay as internal modules within the monolith. Services that are compute-heavy (render, publish) or independently scalable (media) are isolated workers/services communicating via queues.

---

## 2. Database Schema (PostgreSQL)

### 2.1 Core Entity Relationship

```
tenants (1) ──── (N) users
users   (1) ──── (N) projects
projects(1) ──── (N) pages
pages   (1) ──── (N) sections
sections(1) ──── (1) scene_graph (JSONB)

tenants (1) ──── (1) subscriptions
subscriptions ──── plans

templates (1) ──── (N) template_versions
template_versions ──── projects (applied_from)

projects (1) ──── (N) rsvp_responses
projects (1) ──── (N) guestbook_entries
projects (1) ──── (N) published_versions
projects (1) ──── (0..1) custom_domains
```

### 2.2 Table Definitions

```sql
-- TENANT & AUTH
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL DEFAULT 'active'  -- active | suspended | deleted
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,                            -- NULL if OAuth-only
    oauth_provider  TEXT,                            -- google | apple | null
    oauth_id        TEXT,
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'owner',   -- owner | editor | viewer
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- SUBSCRIPTIONS & BILLING
CREATE TABLE plans (
    id              TEXT PRIMARY KEY,                -- 'free' | 'starter' | 'pro' | 'business'
    name            TEXT NOT NULL,
    price_monthly   INTEGER NOT NULL,               -- cents
    price_yearly    INTEGER NOT NULL,               -- cents
    max_projects    INTEGER NOT NULL,
    max_pages_per_project INTEGER NOT NULL,
    max_media_bytes BIGINT NOT NULL,                -- per project
    max_rsvp        INTEGER NOT NULL,
    custom_domain   BOOLEAN NOT NULL DEFAULT false,
    remove_branding BOOLEAN NOT NULL DEFAULT false,
    ai_features     BOOLEAN NOT NULL DEFAULT false,
    analytics_tier  TEXT NOT NULL DEFAULT 'basic'    -- basic | advanced
);

CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id),
    plan_id         TEXT NOT NULL REFERENCES plans(id),
    stripe_customer_id    TEXT,
    stripe_subscription_id TEXT,
    status          TEXT NOT NULL DEFAULT 'active',  -- active | past_due | canceled | trialing
    current_period_start  TIMESTAMPTZ,
    current_period_end    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECTS
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    slug            TEXT NOT NULL,                   -- subdomain: {slug}.elove.me
    title           TEXT NOT NULL,
    description     TEXT,
    template_version_id UUID REFERENCES template_versions(id),
    global_styles   JSONB NOT NULL DEFAULT '{}',     -- fonts, colors, transitions
    seo_meta        JSONB NOT NULL DEFAULT '{}',     -- og:title, og:image, description
    settings        JSONB NOT NULL DEFAULT '{}',     -- music, password_protected, rsvp_enabled
    status          TEXT NOT NULL DEFAULT 'draft',   -- draft | published | archived
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_slug ON projects(slug);

CREATE TABLE pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,                   -- 'home' | 'rsvp' | 'gallery' | 'story'
    title           TEXT NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, slug)
);

CREATE TABLE sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    section_type    TEXT NOT NULL,                   -- 'hero' | 'countdown' | 'gallery' | 'rsvp_form' | 'custom'
    sort_order      INTEGER NOT NULL DEFAULT 0,
    scene_graph     JSONB NOT NULL DEFAULT '{}',     -- THE core data: all visual elements
    animation_config JSONB NOT NULL DEFAULT '{}',    -- entrance, scroll, parallax settings
    visibility      JSONB NOT NULL DEFAULT '{"mobile":true,"desktop":true}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sections_page ON sections(page_id);

-- SCENE GRAPH JSONB STRUCTURE (documented, not enforced in DB)
-- {
--   "elements": [
--     {
--       "id": "el_001",
--       "type": "text|image|shape|video|lottie|countdown|map",
--       "position": { "x": 0, "y": 0, "z": 1 },
--       "size": { "width": 300, "height": 200 },
--       "rotation": 0,
--       "opacity": 1,
--       "content": { ... },           -- type-specific payload
--       "style": { ... },             -- CSS-mappable properties
--       "animation": {
--         "entrance": { "type": "fadeIn", "duration": 800, "delay": 0 },
--         "scroll": { "type": "parallax", "speed": 0.5 }
--       },
--       "responsive": {
--         "mobile": { "position": {...}, "size": {...}, "hidden": false }
--       }
--     }
--   ],
--   "background": { "type": "color|gradient|image|video", "value": "..." },
--   "layout": { "type": "free|stack|grid", "gap": 16 }
-- }

-- MEDIA
CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_key     TEXT NOT NULL,                   -- R2/S3 object key
    dimensions      JSONB,                           -- {width, height} for images/video
    blurhash        TEXT,                            -- placeholder hash
    variants        JSONB DEFAULT '{}',              -- {"thumb": "key", "medium": "key", ...}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_tenant ON media(tenant_id);
CREATE INDEX idx_media_project ON media(project_id);

-- TEMPLATES & MARKETPLACE
CREATE TABLE templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID REFERENCES users(id),       -- NULL = system template
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL,                   -- 'elegant' | 'modern' | 'rustic' | 'minimal' | ...
    tags            TEXT[] NOT NULL DEFAULT '{}',
    preview_url     TEXT NOT NULL,
    thumbnail_url   TEXT NOT NULL,
    is_free         BOOLEAN NOT NULL DEFAULT false,
    price_cents     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'draft',   -- draft | published | archived
    install_count   INTEGER NOT NULL DEFAULT 0,
    rating_avg      NUMERIC(3,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES templates(id),
    version         INTEGER NOT NULL DEFAULT 1,
    schema_version  INTEGER NOT NULL DEFAULT 1,      -- scene_graph schema version
    pages_data      JSONB NOT NULL,                  -- full page+section+scene_graph snapshot
    global_styles   JSONB NOT NULL DEFAULT '{}',
    changelog       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(template_id, version)
);

-- PUBLISHING
CREATE TABLE published_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    version         INTEGER NOT NULL,
    build_hash      TEXT NOT NULL,                   -- content hash for cache busting
    storage_prefix  TEXT NOT NULL,                   -- R2 prefix: published/{project_id}/{version}/
    status          TEXT NOT NULL DEFAULT 'building', -- building | live | rolled_back | failed
    published_by    UUID NOT NULL REFERENCES users(id),
    published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, version)
);

CREATE TABLE custom_domains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL UNIQUE REFERENCES projects(id),
    domain          TEXT NOT NULL UNIQUE,
    cf_hostname_id  TEXT,                            -- Cloudflare for SaaS hostname ID
    ssl_status      TEXT NOT NULL DEFAULT 'pending', -- pending | active | error
    verification_status TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_domains_domain ON custom_domains(domain);

-- RSVP & GUESTBOOK
CREATE TABLE rsvp_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    guest_name      TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    attending        TEXT NOT NULL,                  -- 'yes' | 'no' | 'maybe'
    party_size      INTEGER NOT NULL DEFAULT 1,
    dietary_notes   TEXT,
    custom_fields   JSONB DEFAULT '{}',
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rsvp_project ON rsvp_responses(project_id);

CREATE TABLE guestbook_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    author_name     TEXT NOT NULL,
    message         TEXT NOT NULL,
    is_approved     BOOLEAN NOT NULL DEFAULT false,  -- moderation
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ANALYTICS (append-only, consider TimescaleDB or separate store at scale)
CREATE TABLE page_views (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    project_id      UUID NOT NULL,
    page_slug       TEXT,
    visitor_id      TEXT,                            -- anonymous fingerprint hash
    country         TEXT,
    device_type     TEXT,                            -- mobile | desktop | tablet
    referrer        TEXT,
    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pageviews_project_time ON page_views(project_id, viewed_at);

-- QUOTA TRACKING (materialized, updated on writes)
CREATE TABLE quota_usage (
    tenant_id       UUID PRIMARY KEY REFERENCES tenants(id),
    project_count   INTEGER NOT NULL DEFAULT 0,
    total_media_bytes BIGINT NOT NULL DEFAULT 0,
    rsvp_count_by_project JSONB NOT NULL DEFAULT '{}', -- {"proj_id": count}
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.3 Multi-Tenancy Strategy

**Approach: Shared database, tenant_id column isolation (Row-Level Security)**

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Set tenant context at connection level (application layer)
SET app.current_tenant = '{tenant_uuid}';
```

**Rationale:** At the 100k user scale with wedding-centric data (small per-tenant volume, high tenant count), shared DB with RLS gives the best cost/complexity tradeoff. Sharding is unnecessary until 1M+ tenants.

---

## 3. API Boundary Definition

### 3.1 Public API (REST, versioned)

```
BASE: https://api.elove.me/v1

AUTH
  POST   /auth/register              → Create account
  POST   /auth/login                 → Email/password login
  POST   /auth/oauth/{provider}      → OAuth flow
  POST   /auth/refresh               → Refresh JWT
  DELETE /auth/session               → Logout

PROJECTS
  GET    /projects                   → List user's projects (paginated)
  POST   /projects                   → Create project (quota check)
  GET    /projects/:id               → Get project with pages
  PATCH  /projects/:id               → Update project metadata
  DELETE /projects/:id               → Soft delete project
  POST   /projects/:id/duplicate     → Clone project (quota check)

PAGES
  POST   /projects/:id/pages         → Add page
  PATCH  /pages/:id                  → Update page
  DELETE /pages/:id                  → Remove page
  PATCH  /pages/:id/reorder          → Change sort_order

SECTIONS
  POST   /pages/:id/sections         → Add section
  PATCH  /sections/:id               → Update section (scene_graph)
  DELETE /sections/:id               → Remove section
  PATCH  /sections/:id/scene-graph   → Partial scene_graph update (delta)

MEDIA
  POST   /media/upload               → Presigned URL + create record
  POST   /media/upload/confirm       → Confirm upload complete
  GET    /media?project_id=          → List media for project
  DELETE /media/:id                  → Delete media asset

TEMPLATES
  GET    /templates                  → Browse marketplace (paginated, filterable)
  GET    /templates/:slug            → Template detail + preview
  POST   /templates/:slug/install    → Apply to new project

PUBLISH
  POST   /projects/:id/publish       → Trigger build + deploy
  GET    /projects/:id/publish/status → Build status
  POST   /projects/:id/rollback      → Rollback to previous version

DOMAINS
  POST   /projects/:id/domain        → Add custom domain
  GET    /projects/:id/domain/status  → SSL + verification status
  DELETE /projects/:id/domain         → Remove custom domain

RSVP
  GET    /projects/:id/rsvp          → List responses (owner only)
  POST   /projects/:id/rsvp/export   → CSV export

GUESTBOOK
  GET    /projects/:id/guestbook     → List entries (owner only)
  PATCH  /guestbook/:id/approve      → Approve entry

BILLING
  GET    /billing/plans              → Available plans
  POST   /billing/checkout           → Create Stripe checkout session
  POST   /billing/portal             → Stripe customer portal URL
  GET    /billing/usage              → Current quota usage

ANALYTICS
  GET    /projects/:id/analytics     → View stats (time range, granularity)
```

### 3.2 Public Edge API (Served from CDN/Edge, no auth)

```
VISITOR-FACING (edge functions, no origin roundtrip for reads)

  POST   /v/rsvp/:project_slug       → Submit RSVP (rate-limited)
  POST   /v/guestbook/:project_slug  → Submit guestbook entry (rate-limited)
  GET    /v/countdown/:project_slug   → Get countdown target timestamp
```

### 3.3 Internal API (Service-to-Service)

```
RENDER WORKER (queue-triggered)
  Input:  { project_id, version, scene_graphs[], global_styles, media_manifest }
  Output: { build_hash, files[] → R2 }

PUBLISH WORKER (queue-triggered)
  Input:  { project_id, version, build_hash, target_slug, custom_domain? }
  Output: { deployed: true, urls[], cdn_purge_status }
```

### 3.4 Webhook Endpoints

```
  POST   /webhooks/stripe            → Subscription events
  POST   /webhooks/cloudflare        → Domain verification events
```

---

## 4. Rendering Flow (JSON → HTML)

### 4.1 Architecture

The render engine is the core technical differentiator. It converts the JSON scene graph into optimized static HTML/CSS/JS.

```
┌──────────────────────────────────────────────────────────────┐
│                    RENDER PIPELINE                            │
│                                                              │
│  ┌────────────┐    ┌────────────┐    ┌────────────────────┐ │
│  │  1. FETCH   │───▶│  2. RESOLVE │───▶│  3. COMPILE        │ │
│  │             │    │             │    │                    │ │
│  │  Load all   │    │  Resolve    │    │  scene_graph →     │ │
│  │  pages +    │    │  media URLs │    │  HTML elements     │ │
│  │  sections + │    │  to CDN     │    │                    │ │
│  │  scene      │    │  paths      │    │  animation_config →│ │
│  │  graphs     │    │             │    │  CSS keyframes +   │ │
│  │             │    │  Resolve    │    │  JS controllers    │ │
│  │             │    │  fonts to   │    │                    │ │
│  │             │    │  subsets    │    │  global_styles →   │ │
│  └────────────┘    └────────────┘    │  CSS custom props  │ │
│                                       └─────────┬──────────┘ │
│                                                 │            │
│  ┌────────────────────┐    ┌────────────────────▼──────────┐ │
│  │  5. PACKAGE         │◀───│  4. OPTIMIZE                  │ │
│  │                     │    │                               │ │
│  │  index.html         │    │  Critical CSS inline          │ │
│  │  style.[hash].css   │    │  CSS tree-shake unused        │ │
│  │  app.[hash].js      │    │  JS code-split per page       │ │
│  │  assets/            │    │  Image srcset generation      │ │
│  │  manifest.json      │    │  HTML minify                  │ │
│  │                     │    │  Preload hints                │ │
│  └─────────┬──────────┘    └───────────────────────────────┘ │
│            │                                                  │
└────────────┼──────────────────────────────────────────────────┘
             ▼
        Upload to R2
     at published/{project_id}/{version}/
```

### 4.2 Scene Graph → HTML Compilation Rules

```
Element Type    →  HTML Output
────────────────────────────────────────────────────────
text            →  <div> with contenteditable-sourced HTML, styled spans
image           →  <picture> with <source> srcset for webp/avif + <img> fallback
shape           →  <svg> inline or <div> with CSS clip-path
video           →  <video> with poster frame, lazy-loaded
lottie          →  <div data-lottie="url"> + lottie-player script
countdown       →  <div data-countdown="timestamp"> + JS counter
map             →  <div data-map="lat,lng"> + lazy Google Maps embed
gallery         →  <div class="gallery"> + lightbox JS
rsvp_form       →  <form data-rsvp> + client-side validation + POST handler
guestbook       →  <div data-guestbook> + load/submit JS
```

### 4.3 Animation Compilation

```
Animation Config (JSON)              →  Output
─────────────────────────────────────────────────────
entrance.type: "fadeIn"              →  @keyframes + IntersectionObserver trigger
entrance.type: "slideUp"             →  @keyframes with transform + IO trigger
scroll.type: "parallax"              →  CSS transform: translateY(calc(...)) or
                                        requestAnimationFrame-based parallax JS
scroll.type: "reveal"                →  ScrollTimeline CSS (progressive enhance)
transition.type: "page"              →  View Transitions API (with FLIP fallback)
```

### 4.4 Responsive Strategy

Each element can have a `responsive.mobile` override. The compile step generates:

```css
/* Desktop-first base styles from scene_graph */
.el_001 { left: 200px; top: 100px; width: 400px; }

/* Mobile override from responsive.mobile */
@media (max-width: 768px) {
  .el_001 { left: 20px; top: 50px; width: calc(100vw - 40px); }
}
```

Elements with `responsive.mobile.hidden: true` get `display: none` in the mobile breakpoint.

---

## 5. Publish Flow

### 5.1 Full Pipeline

```
USER clicks "Publish"
         │
         ▼
┌─────────────────────────┐
│  1. QUOTA CHECK          │  ← Is tenant on active plan? Project within limits?
│     (synchronous)        │
└────────────┬────────────┘
             │ OK
             ▼
┌─────────────────────────┐
│  2. CREATE VERSION       │  ← Insert published_versions row (status: 'building')
│     (synchronous)        │  ← Snapshot current scene_graphs (immutable)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  3. ENQUEUE BUILD        │  ← Push to Redis/SQS queue
│     (async)              │  ← Return build_id to client for polling
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  4. RENDER WORKER        │  ← Picks up job from queue
│     (isolated)           │  ← Executes full render pipeline (§4)
│                          │  ← Uploads static files to R2
│                          │  ← Generates build_hash
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  5. DEPLOY               │  ← Update KV routing table:
│     (edge config)        │     slug → { r2_prefix, build_hash, custom_domain }
│                          │  ← Purge CDN cache for slug
│                          │  ← Update published_versions status → 'live'
│                          │  ← Mark previous version → 'rolled_back'
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  6. NOTIFY               │  ← WebSocket push to editor: "Published!"
│                          │  ← Optional: email notification
└─────────────────────────┘
```

### 5.2 Serving Published Sites

```
Visitor hits {slug}.elove.me or custom-domain.com
         │
         ▼
┌─────────────────────────┐
│  Cloudflare Worker       │
│                          │
│  1. Resolve domain:      │
│     - subdomain? extract │
│       slug from host     │
│     - custom domain?     │
│       lookup in KV       │
│                          │
│  2. KV lookup:           │
│     slug → {             │
│       r2_prefix,         │
│       build_hash,        │
│       plan_tier          │
│     }                    │
│                          │
│  3. Serve from R2:       │
│     R2.get(r2_prefix +   │
│       request.pathname)  │
│                          │
│  4. Cache headers:       │
│     immutable assets:    │
│       Cache-Control:     │
│       public, max-age=   │
│       31536000, immutable│
│     index.html:          │
│       Cache-Control:     │
│       public, max-age=60,│
│       s-maxage=3600      │
│                          │
│  5. Inject if free plan: │
│     "Made with ELove"    │
│     badge (not in HTML   │
│     source, injected via │
│     HTMLRewriter)        │
└─────────────────────────┘
```

### 5.3 Custom Domain Flow

```
User adds domain "wedding.smith.com"
         │
         ▼
┌──────────────────────────────────────────────┐
│  1. Create custom_domains record              │
│  2. Call Cloudflare for SaaS API:             │
│     POST /zones/{zone}/custom_hostnames       │
│     → Returns ownership_verification TXT      │
│     → Returns SSL validation CNAME            │
│  3. Show user DNS records to add:             │
│     CNAME wedding.smith.com → proxy.elove.me  │
│     TXT   _cf-custom-hostname.wedding....     │
│  4. Poll verification (webhook or cron):      │
│     - DNS propagated? → ssl_status: 'active'  │
│  5. Update KV:                                │
│     "wedding.smith.com" → same R2 prefix      │
└──────────────────────────────────────────────┘
```

---

## 6. Subscription + Quota Enforcement

### 6.1 Plan Tiers

```
                FREE        STARTER ($9/mo)  PRO ($19/mo)    BUSINESS ($39/mo)
────────────────────────────────────────────────────────────────────────────────
Projects        1           3                10              Unlimited
Pages/Project   3           8                20              Unlimited
Media Storage   50 MB       500 MB           2 GB            10 GB
RSVP Responses  30          200              1,000           Unlimited
Custom Domain   ✗           ✗                ✓               ✓
Remove Branding ✗           ✓                ✓               ✓
AI Features     ✗           ✗                ✓               ✓
Analytics       Basic       Basic            Advanced        Advanced
Templates       Free only   All              All + Early     All + Early
```

### 6.2 Enforcement Points

```
┌──────────────────────────────────────────────────────────────────────┐
│                   QUOTA ENFORCEMENT ARCHITECTURE                      │
│                                                                      │
│  WRITE PATH (API Layer - synchronous)                                │
│  ─────────────────────────────────────                               │
│                                                                      │
│  Every mutating request passes through:                              │
│                                                                      │
│  Request → Auth middleware → Tenant resolver → Quota middleware       │
│                                                                      │
│  Quota middleware:                                                    │
│  1. Load plan limits (cached in Redis, 5min TTL)                     │
│  2. Load current usage from quota_usage table (cached in Redis)      │
│  3. Compare: would this action exceed any limit?                     │
│     - POST /projects        → check project_count < max_projects     │
│     - POST /pages           → check page_count < max_pages_per_proj  │
│     - POST /media/upload    → check total_media_bytes < max_media    │
│     - POST /v/rsvp/:slug    → check rsvp_count < max_rsvp           │
│  4. If exceeded → 402 Payment Required + upgrade prompt payload      │
│  5. If OK → proceed + increment quota_usage atomically               │
│                                                                      │
│  READ PATH (No enforcement needed)                                   │
│  ──────────────────────────────────                                  │
│                                                                      │
│  RENDER PATH (Publish Service)                                       │
│  ─────────────────────────────                                       │
│                                                                      │
│  1. Check subscription.status = 'active' or 'trialing'              │
│  2. If 'past_due' → block publish, return billing error              │
│  3. If free plan → inject branding badge via HTMLRewriter            │
│  4. If no custom_domain permission → skip domain config              │
│                                                                      │
│  FEATURE FLAGS (checked at API + client level)                       │
│  ─────────────────────────────────────────────                       │
│                                                                      │
│  plan.ai_features       → gate AI text generation, image enhance     │
│  plan.custom_domain     → gate domain settings UI + API              │
│  plan.remove_branding   → gate branding toggle in settings           │
│  plan.analytics_tier    → gate advanced analytics queries            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Billing Event Flow (Stripe Webhooks)

```
Stripe Event                    → System Action
──────────────────────────────────────────────────────────
checkout.session.completed      → Create subscription, update plan
invoice.paid                    → Extend current_period_end
invoice.payment_failed          → Set status = 'past_due', email user
customer.subscription.updated   → Sync plan changes (up/downgrade)
customer.subscription.deleted   → Set status = 'canceled', start grace period
```

**Grace period on cancellation:** 7 days. During grace, published sites stay live. After grace, unpublish and set project status to 'archived'. Data retained 90 days.

---

## 7. Scalability Risk Assessment

### 7.1 Identified Risks

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | **Scene graph JSONB bloat** — Large projects with many elements create multi-MB JSON documents. Frequent saves hammer DB with large writes. | High | High | Implement delta-patch saves (JSON Patch RFC 6902). Store full snapshots every N edits; patches in between. Compress JSONB with pg_lz. Set max element count per section (200). |
| 2 | **Render worker bottleneck** — Viral invitation spikes publish queue. Single build takes 5-15 seconds. | High | Medium | Horizontally scale render workers (stateless). Priority queue: paid users get dedicated lane. Cache template-level compilation (only re-render changed sections). Target: <30s p99 build time. |
| 3 | **Media storage cost explosion** — Users upload unoptimized 10MB photos. 100k users × 500MB = 50TB. | High | High | Client-side compression before upload (browser-image-compression). Server-side: auto-convert to WebP/AVIF via imgproxy. Aggressive dedup via content-hash. R2 is $0.015/GB/mo (vs S3 $0.023), so ~$750/mo for 50TB on R2. Lifecycle policy: delete media for archived projects after 90 days. |
| 4 | **CDN cache invalidation storms** — Frequent republishing by many users creates cache purge thundering herd. | Medium | Medium | Content-addressed assets (hash in filename = never purge). Only index.html needs purge. Use stale-while-revalidate for index.html. Batch purge requests via queue with 5-second debounce. |
| 5 | **RSVP/Guestbook spam** — Public-facing forms get bot-hammered. | Medium | High | Cloudflare Turnstile (free CAPTCHA alternative). Rate limit: 5 submissions per IP per hour per project. Honeypot fields. Optional: require invitation code (premium feature). |
| 6 | **Analytics table growth** — page_views is append-only. At scale: 100k projects × 100 views/day = 10M rows/day. | Medium | Medium | Partition page_views by month. Roll up to daily aggregates after 30 days. Consider ClickHouse or Tinybird for analytics at >1M DAU. For now, TimescaleDB extension on PostgreSQL suffices. |
| 7 | **Template marketplace abuse** — Bad actors upload malicious templates with XSS payloads in scene_graph. | High | Low | Template review pipeline: automated HTML sanitization + manual review for marketplace. System templates bypass review. All user-generated content is rendered through the compile step, never raw innerHTML. Strict CSP headers on published sites. |
| 8 | **Custom domain SSL provisioning lag** — Cloudflare for SaaS has limits on concurrent hostname additions. | Low | Low | Queue domain additions, process serially. Free plan doesn't get domains. At Pro tier, expected volume is manageable (<1000 concurrent pending). |

### 7.2 Scaling Thresholds

```
PHASE 1: 0 → 10k users
  PostgreSQL (Neon serverless) — single database, branching for staging
  Redis (Upstash serverless) — auto-scales
  R2 (Cloudflare) — no egress fees
  Render workers: 2 concurrent (queue-based)
  Estimated infra cost: $50-150/mo

PHASE 2: 10k → 100k users
  PostgreSQL — dedicated instance (Neon Pro or Supabase Pro), read replicas for analytics
  Add connection pooling (PgBouncer)
  Render workers: 5-10 concurrent, auto-scaled
  Add ClickHouse/Tinybird for analytics offload
  Estimated infra cost: $500-1,500/mo

PHASE 3: 100k → 1M users
  PostgreSQL — horizontal read replicas, consider Citus for tenant sharding
  Dedicated media processing pipeline (separate service)
  Render farm: 20+ workers with spot instances
  Consider moving render to WebAssembly for client-side preview builds
  Estimated infra cost: $3,000-8,000/mo
```

---

## 8. Technical Moat Opportunities

| Moat | Description | Defensibility |
|------|-------------|---------------|
| **Scene Graph Schema** | Proprietary JSON schema that encodes layout, animation, responsive behavior, and interactivity. Deep investment in schema evolution, migration tooling, and expressiveness creates switching cost. | High — competitors must re-invent or reverse-engineer |
| **Render Engine Quality** | The JSON → HTML compiler is the product. Optimized output (Lighthouse 95+), smooth animations, correct responsive behavior. This is where engineering hours compound. | High — takes years to match quality |
| **Template Ecosystem** | Network effect: more templates attract users, more users attract template creators. Revenue share model (70/30) incentivizes quality. | Medium-High — marketplace flywheel |
| **AI Integration Layer** | AI-assisted copy generation, image enhancement (upscale, background removal), layout suggestions, and style transfer from reference images. Uses the scene graph as structured context for LLM prompts. | Medium — moves fast, but schema integration is defensible |
| **Wedding-Specific Data Model** | RSVP logic, dietary management, multi-event support (ceremony, reception, after-party), guest grouping, seating charts. Deep domain modeling that generic builders can't match. | Medium — domain depth compounds |
| **Edge-First Architecture** | Published sites served from edge with zero origin latency. Sub-100ms TTFB globally. Visitors experience native-app-level performance. | Low-Medium — architecture is copyable, but execution matters |

---

## 9. Recommended Tech Stack

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| **Frontend Framework** | Next.js 15 (App Router) | RSC for dashboard, client components for editor. Vercel deployment. Huge ecosystem. |
| **Visual Editor** | React + Konva.js (canvas) | Hardware-accelerated canvas for smooth drag/drop. Better performance than DOM-based editors for complex scenes. Fabric.js is the alternative if SVG-first is preferred. |
| **API Runtime** | Next.js API Routes + tRPC | Type-safe API layer, co-located with frontend, zero-config deployment. tRPC eliminates API contract drift. |
| **Database** | PostgreSQL on Neon | Serverless scaling, branching for dev/staging, generous free tier. Scale to dedicated when needed. |
| **Cache / Queue** | Upstash Redis | Serverless Redis. Rate limiting, session cache, publish queue, quota cache. Pay-per-request. |
| **Object Storage** | Cloudflare R2 | S3-compatible, zero egress fees (critical for media-heavy product). Native Workers integration. |
| **CDN / Edge** | Cloudflare (Workers + Pages + R2) | Workers for dynamic edge logic (routing, RSVP). Pages for marketing site. R2 serving via Workers. Cloudflare for SaaS for custom domains + auto-SSL. |
| **Image Processing** | imgproxy (self-hosted) or Cloudflare Images | On-the-fly resize/format conversion. imgproxy is cheaper at scale; CF Images is simpler. |
| **Payments** | Stripe Billing | Subscription management, metered billing ready, customer portal, tax calculation, global payments. |
| **Auth** | Clerk or NextAuth.js v5 | Clerk for faster launch (hosted UI, OAuth, MFA). NextAuth if cost-sensitive (self-hosted). |
| **Email** | Resend | Transactional emails (publish confirmation, RSVP notifications). React Email for templates. |
| **Monitoring** | Sentry + Axiom | Sentry for error tracking. Axiom for structured logs (generous free tier, Vercel-native). |
| **Animation Runtime** | GSAP (published sites) | Industry-standard animation library. ScrollTrigger for scroll-based animations. License is free for non-commercial use per-site (each wedding site qualifies); SaaS platform needs business license ($199/yr). |
| **AI Layer (future)** | Anthropic Claude API / OpenAI | Structured outputs from Claude for scene_graph manipulation. Image generation via DALL-E or Stability. |

---

## 10. 90-Day Execution Roadmap

### Phase 1: Foundation (Days 1–30)

```
WEEK 1-2: Project Setup + Data Layer
├── Initialize Next.js 15 monorepo (turborepo structure)
├── Configure Neon PostgreSQL + run schema migrations
├── Set up Clerk auth (Google OAuth + email/password)
├── Implement tenant creation on signup
├── Set up Upstash Redis for session + cache
├── CI/CD pipeline: GitHub Actions → Vercel
└── Design system: Tailwind + shadcn/ui component library

WEEK 3-4: Core API + Basic Editor Shell
├── Implement tRPC routers: projects, pages, sections CRUD
├── Build project dashboard UI (list, create, delete)
├── Build basic editor layout (sidebar + canvas area)
├── Implement media upload flow (presigned URL → R2)
├── Image processing pipeline (resize on upload via Worker)
├── Build scene_graph JSONB read/write with validation
└── Implement basic quota_usage tracking
```

### Phase 2: Editor + Templates (Days 31–60)

```
WEEK 5-6: Visual Editor Core
├── Konva.js canvas integration with React
├── Element CRUD on canvas (text, image, shape)
├── Drag, resize, rotate interactions
├── Property panel (style, position, animation config)
├── Undo/redo stack (command pattern, client-side)
├── Auto-save with debounced PATCH to scene_graph
└── Mobile responsive preview toggle

WEEK 7-8: Templates + Rendering
├── Design and build 5 launch templates (data as seed)
├── Template browsing UI with previews
├── "Use Template" flow → clone into new project
├── Build render engine v1 (JSON → HTML compiler)
│   ├── Text, image, shape element renderers
│   ├── CSS animation generation from config
│   ├── Responsive breakpoint compilation
│   └── Asset optimization (inline critical CSS, minify)
├── Template versioning schema
└── Template preview generation (headless screenshot)
```

### Phase 3: Publishing + Billing (Days 61–90)

```
WEEK 9-10: Publish Pipeline + Serving
├── Build publish queue (Redis-based)
├── Render worker: queue consumer → R2 upload
├── Cloudflare Worker for subdomain routing (KV lookup)
├── Cache strategy implementation (content-addressed assets)
├── Branding badge injection (HTMLRewriter) for free tier
├── RSVP form: edge function for submission + validation
├── Guestbook: submission + moderation UI
└── Basic analytics: edge log collection + dashboard

WEEK 11-12: Billing + Launch Prep
├── Stripe integration: plans, checkout, webhooks
├── Quota enforcement middleware (all enforcement points)
├── Customer portal (manage subscription, invoices)
├── Custom domain flow (Cloudflare for SaaS integration)
├── Marketing site (Next.js Pages, template showcase)
├── SEO: og:image generation for shared invitations
├── Load testing: simulate 1000 concurrent publishes
├── Security audit: CSP headers, input sanitization, RLS verification
├── Soft launch to 100 beta users
└── Iterate on feedback, fix critical bugs
```

### Key Milestones

```
Day 14  │  Auth + DB + basic CRUD working
Day 30  │  Editor shell renders scene_graph, media uploads work
Day 45  │  Editor fully interactive (drag/drop/resize/style)
Day 60  │  5 templates live, render engine produces valid HTML
Day 75  │  End-to-end publish flow: edit → publish → visit → RSVP
Day 85  │  Stripe billing + quota enforcement active
Day 90  │  Beta launch with 5 templates, 4 plan tiers, subdomain publishing
```

### Post-90-Day Priorities

```
Q2: AI features (copy generation, image enhance, layout suggestions)
Q2: Template marketplace (creator onboarding, revenue share)
Q2: Collaboration (real-time co-editing via CRDT/Yjs)
Q3: Mobile editor (simplified, touch-optimized)
Q3: Advanced analytics (funnel: view → RSVP → attend)
Q3: Internationalization (RTL support, multi-language templates)
Q4: White-label / agency tier
Q4: Seating chart builder (premium feature)
```

---

## Appendix A: Key Technical Decisions Log

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Multi-tenancy | Shared DB + RLS | DB-per-tenant, Schema-per-tenant | Cost. Wedding data is small per tenant. 100k tenants × separate DBs is unmanageable. RLS provides sufficient isolation. |
| Editor rendering | Canvas (Konva) | DOM-based (GrapesJS, Craft.js) | Performance for animation-heavy content. Canvas handles 200+ elements without DOM thrash. Trade-off: accessibility in editor (mitigated: published output is semantic HTML). |
| Published site format | Static HTML | SSR, SPA | Cost efficiency (zero compute for serving). SEO-friendly. Global edge caching. Trade-off: dynamic features (RSVP, guestbook) handled via edge functions. |
| Object storage | R2 | S3, GCS | Zero egress. Wedding sites are media-heavy; egress costs on S3 would be the #1 expense at scale. R2 S3-compatible API means easy migration if needed. |
| Payments | Stripe Billing | Paddle, LemonSqueezy | Subscription lifecycle management, global tax handling, customer portal, metered billing for future usage-based pricing. Higher rev share but lower engineering cost. |
| State management | tRPC + React Query | REST + SWR, GraphQL | Type safety end-to-end. No schema drift. React Query handles caching, optimistic updates, and background refetching. GraphQL overhead not justified for this data shape. |

---

## Appendix B: Scene Graph Schema (v1 Specification)

```jsonc
{
  "$schema": "elove/scene-graph/v1",
  "elements": [
    {
      "id": "string (nanoid)",
      "type": "text | image | shape | video | lottie | countdown | map | gallery | rsvp_form | guestbook | divider",
      "name": "string (user-facing label)",
      "locked": "boolean",
      "visible": "boolean",
      "position": {
        "x": "number (px from left)",
        "y": "number (px from top)",
        "z": "number (layer order)"
      },
      "size": {
        "width": "number | 'auto'",
        "height": "number | 'auto'"
      },
      "rotation": "number (degrees)",
      "opacity": "number (0-1)",
      "content": {
        // type=text:
        "html": "string (sanitized rich text)",
        "fontFamily": "string",
        "fontSize": "number",
        "fontWeight": "number",
        "color": "string (#hex)",
        "textAlign": "left | center | right",
        "lineHeight": "number",
        "letterSpacing": "number",

        // type=image:
        "src": "string (media ID reference)",
        "alt": "string",
        "objectFit": "cover | contain | fill",
        "filter": "string (CSS filter)",

        // type=countdown:
        "targetDate": "string (ISO 8601)",
        "format": "days | dhms | custom",
        "labels": { "days": "Days", "hours": "Hours", ... },

        // type=shape:
        "shapeType": "rect | circle | line | polygon | custom",
        "fill": "string",
        "stroke": "string",
        "strokeWidth": "number",
        "svgPath": "string (for custom)"
      },
      "style": {
        "backgroundColor": "string",
        "borderRadius": "number",
        "border": "string (CSS shorthand)",
        "boxShadow": "string",
        "backdropFilter": "string",
        "padding": "number | [t, r, b, l]"
      },
      "animation": {
        "entrance": {
          "type": "none | fadeIn | slideUp | slideDown | slideLeft | slideRight | zoomIn | bounceIn | flipIn",
          "duration": "number (ms)",
          "delay": "number (ms)",
          "easing": "string (CSS easing)"
        },
        "scroll": {
          "type": "none | parallax | reveal | fadeOnScroll | scaleOnScroll",
          "speed": "number (-1 to 1, for parallax)",
          "triggerOffset": "number (0-1, viewport fraction)"
        },
        "hover": {
          "type": "none | scale | lift | glow | colorShift",
          "intensity": "number (0-1)"
        },
        "loop": {
          "type": "none | pulse | float | rotate | shimmer",
          "duration": "number (ms)"
        }
      },
      "responsive": {
        "mobile": {
          "position": { "x": "number", "y": "number" },
          "size": { "width": "number", "height": "number" },
          "hidden": "boolean",
          "fontSize": "number (override)"
        }
      },
      "interactions": {
        "onClick": "none | navigate | openUrl | scrollTo | playMusic",
        "target": "string (URL or element ID)"
      }
    }
  ],
  "background": {
    "type": "color | gradient | image | video",
    "value": "string",
    "overlay": "string (rgba for dimming)"
  },
  "layout": {
    "type": "free | stack | grid",
    "direction": "vertical | horizontal",
    "gap": "number",
    "alignment": "start | center | end | stretch",
    "padding": "number | [t, r, b, l]"
  },
  "music": {
    "src": "string (media ID)",
    "autoplay": "boolean",
    "loop": "boolean",
    "volume": "number (0-1)"
  }
}
```

---

*End of Architecture Document*
