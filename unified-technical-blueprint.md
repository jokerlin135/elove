# ELove Platform — Unified Technical Blueprint

**Version:** 2.0 (Consolidated)
**Date:** March 3, 2026
**Purpose:** Critical review and consolidation of five prior design documents into a single authoritative blueprint. Identifies contradictions, overengineering, cost risks, and scaling risks. Provides a simplified, internally consistent architecture.

**Supersedes:**
- `architecture-saas-wedding-platform.md` (v1)
- `template-engine-deep-dive.md` (v1)
- `visual-editor-system-design.md` (v1)
- `publishing-engine-design.md` (v1)
- `monetization-engine-design.md` (v1)

---

## Table of Contents

1. Critical Review: Contradictions Found
2. Critical Review: Overengineering Identified
3. Critical Review: Cost Risks
4. Critical Review: Scaling Risks
5. Critical Review: Missing Pieces
6. Simplified Architecture (Resolved)
7. Unified Data Model
8. Unified Rendering + Publishing Pipeline
9. Unified Editor Architecture
10. Unified Monetization Model
11. Revised Tech Stack
12. Revised 90-Day Roadmap

---

## 1. Critical Review: Contradictions Found

### C1. Plan Tiers Mismatch

**Architecture doc (§6.1):** Defines four tiers — `free`, `starter`, `pro`, `business`. The `plans` table has `id TEXT` with values `'free' | 'starter' | 'pro' | 'business'`.

**Monetization doc (§1.1):** Revises to three tiers — `free`, `pro`, `lifetime`. Explicitly states the architecture doc's four tiers are replaced.

**Editor doc (§3.4):** References the old four-tier model in Section Insertion Rules: "Free: max 6 sections, Starter: max 12, Pro: max 30, Business: unlimited."

**Resolution:** Adopt the three-tier model (free/pro/lifetime). The editor doc's section limits must be revised: Free: max 8 sections, Pro: unlimited, Lifetime: unlimited. The `starter` and `business` tiers never existed. All references updated in this document.

### C2. Canvas Library Inconsistency

**Architecture doc (§1 diagram):** Lists "React + Fabric.js/Konva" for the visual editor.

**Editor doc (§1.3):** Commits to Konva.js specifically. Never mentions Fabric.js.

**Template engine doc (§2.3):** References "Konva nodes (canvas)" for the editor renderer.

**Resolution:** Konva.js only. Fabric.js was a placeholder in the architecture overview. Remove all Fabric.js references. Konva is the correct choice: lighter weight, better React integration via `react-konva`, and simpler API for our use case (we don't need Fabric's built-in serialization since we have our own JSON document model).

### C3. Database Schema Divergence

**Architecture doc (§2):** Defines a `plans` table with limits as direct columns (`max_projects`, `max_pages_per_project`, `max_media_bytes`, `max_rsvp`, `custom_domain`, `remove_branding`, `ai_features`, `analytics_tier`).

**Monetization doc (§1.2):** Replaces with a `plans` + `plan_entitlements` two-table model where features are rows, not columns.

**Resolution:** Adopt the two-table model. The architecture doc's column-based `plans` table is deprecated. The entitlement table is more extensible and avoids ALTER TABLE for new features. However, simplification: drop `value_type` from `plan_entitlements` — use a single `value TEXT` column with application-level type coercion. This avoids three nullable value columns (`value_int`, `value_bool`, `value_str`) which is a schema smell.

### C4. Subscription Status Enum Mismatch

**Architecture doc:** `status TEXT` — `'active' | 'past_due' | 'canceled' | 'trialing'`.

**Monetization doc:** Adds `'lifetime'` as a fifth status.

**Resolution:** `lifetime` is a valid status for one-time purchases. The full enum is: `'active' | 'past_due' | 'canceled' | 'trialing' | 'lifetime' | 'grace_period'`. Add `grace_period` explicitly rather than deriving it from `canceled` + `grace_period_end IS NOT NULL` (the explicit status simplifies every query that checks subscription state).

### C5. RSVP Quota Enforcement Conflict

**Architecture doc (§6):** The quota middleware blocks requests when quota is exceeded. No exceptions mentioned.

**Monetization doc (§3.4):** RSVP has a soft quota — accepts responses up to 2× the limit, then hard blocks. This contradicts the architecture doc's blanket blocking behavior.

**Resolution:** Adopt the soft quota model for RSVP. The quota middleware must support a `quota_type: 'hard' | 'soft'` distinction per quota key. Soft quotas return a `X-Quota-Warning: true` header instead of 403. The RSVP edge function reads this header and decides whether to accept or reject. This is the correct design — blocking a wedding guest's RSVP is an unacceptable UX failure.

### C6. Autosave Version vs Published Version

**Editor doc (§7.1):** Defines `serverVersion` as an integer counter that increments on every autosave.

**Publishing doc (§1.1):** The publish pipeline increments a `version` counter and creates a `published_versions` row.

**Architecture doc (§2):** The `published_versions` table has its own `version INTEGER` separate from any edit version.

**These are two different version counters.** The editor doc acknowledges this (§7.1: "three version scopes") but the naming is ambiguous. `version` in the publish pipeline context means "published version 1, 2, 3..." while `serverVersion` in the editor context means "autosave checkpoint counter."

**Resolution:** Rename for clarity across all systems: `edit_revision` (autosave counter, high-frequency), `publish_version` (publish counter, low-frequency), `save_point_id` (UUID for named snapshots). This removes all ambiguity.

### C7. Rendering Pipeline Ownership

**Template engine doc (§3):** Describes a 15-step render pipeline that runs at publish time. Steps 1-13 produce final HTML.

**Publishing doc (§1):** Describes a 7-state publish state machine where the BUILD state "runs the 15-step render pipeline."

**Architecture doc:** Attributes rendering to the "Render Engine" as an "isolated worker."

**Editor doc:** The editor uses a "live preview" that must also render templates — but through the editor renderer, not the static renderer.

**Contradiction:** The editor's live preview needs a subset of the render pipeline (steps 1-9 approximately), but this is never specified. The template engine doc implies the pipeline only runs at publish time.

**Resolution:** The 15-step pipeline is the *publish* pipeline only. The editor uses a separate, lighter-weight *editor render loop* that:
1. Reads the four-layer document from the Document Store
2. Resolves theme tokens to CSS custom properties (equivalent to Step 5)
3. Renders each section via the editor renderer (DOM or Konva) — NOT the static renderer
4. Does NOT run Steps 11-15 (CSS extraction, JS bundling, HTML assembly, hashing, upload)

The editor render loop is synchronous and runs on every document change. The 15-step pipeline is asynchronous and runs only on publish. They share the component registry but use different render targets.

---

## 2. Critical Review: Overengineering Identified

### O1. Four-Layer Architecture Complexity

**Current design:** Structure, Theme, Content, Behavior as four independent JSON documents that are versioned, merged, and composed separately. Each layer can be independently updated, A/B tested, and swapped.

**Problem:** This is the architecture for Webflow, not for a wedding invitation builder. The actual user behavior is:
1. Pick a template
2. Change names, dates, photos
3. Maybe change colors
4. Publish

99% of users will never independently version their behavior layer or A/B test structural variants. The four-layer separation adds complexity to every system that touches the document: editor state management, autosave diffs, conflict resolution, validation, and the render pipeline.

**Simplification:** Keep the four-layer *concept* for internal organization, but store them as a single JSONB document with four top-level keys. Don't version layers independently — version the whole document. Don't diff layers independently for autosave — diff the whole document (JSON Patch or full replacement). The theme layer stays separate because theme-switching is a real feature, but structure/content/behavior merge into a single "project document."

**Revised model:**
```
project_document: {
  structure: { pages, sections, slots, globalSlots }
  content: { data, slotContent, customSections }
  behavior: { sectionBehaviors, pageTransitions, globalBehaviors }
}
theme: {
  baseThemeId: string
  overrides: { color, typography, ... }
}
```

Two top-level objects, not four. Theme is separate because it's swappable. Everything else is the project document. This cuts the conflict resolution matrix from 4×4 (16 layer combinations) to 2×2 (4 combinations: document vs theme, each from local vs server).

### O2. JSON Patch (RFC 6902) for A/B Variants

**Current design:** A/B variants are expressed as JSON Patch diffs against the base template.

**Problem:** A/B testing wedding invitation layouts is a feature that zero users will request in the first 12 months. The JSON Patch variant system adds complexity to: the render pipeline (must apply patches before rendering), the template versioning system (variants must be rebased when templates update), and the editor (must show variant state). All for a feature no one asked for.

**Simplification:** Remove A/B variant system entirely. If needed later, it can be implemented as separate template versions with a traffic-splitting layer at the CDN Worker level. This is simpler and doesn't require any schema or pipeline changes.

### O3. Copy-on-Write Template Dedup

**Current design:** Projects reference templates by pointer. On first structural edit, the structure is copied into the project (copy-on-write).

**Problem:** The complexity of maintaining pointer vs. copy state, detach triggers, and the "fork + optional rebase" update model is high. The storage savings (3.5GB at 100k projects) cost ~$0.05/month on R2. This optimization saves approximately $0.60/year while adding a permanent branching model to maintain.

**Simplification:** Always copy the full template into the project on creation. Templates are seeds, not live references. When a template updates, show a "new version available" notification with a one-click "apply update" that does a full replacement of unmodified structure (comparing against the original template snapshot stored at creation time). This is simpler to reason about and eliminates the null-vs-copy ambiguity in every system that reads the document.

### O4. 35-Type Command Catalog with Batch IDs

**Current design:** 35 typed commands, each with specific payloads, batch grouping, and metadata.

**Problem:** This is a good architecture but the granularity is premature. For MVP, you need about 12 commands: `UPDATE_CONTENT`, `UPDATE_THEME_TOKEN`, `ADD_SECTION`, `REMOVE_SECTION`, `REORDER_SECTION`, `ADD_PAGE`, `REMOVE_PAGE`, `REORDER_PAGE`, `UPDATE_LAYOUT`, `UPDATE_ANIMATION`, `UPDATE_SEO`, `UPDATE_SETTINGS`. The remaining 23 can be derived from these or added when needed.

**Simplification:** Start with 12 commands. Use a generic `UPDATE_CONTENT` command with a JSON path instead of separate `UPDATE_TEXT`, `UPDATE_IMAGE`, `UPDATE_DATA`, `BULK_UPDATE_CONTENT`. The typed specificity can be added later when the editor matures.

### O5. Yjs CRDT Collaboration Path

**Current design:** A four-phase plan to adopt Yjs CRDTs for real-time collaboration.

**Problem:** Designing for CRDTs now constrains the document model (must be CRDT-compatible data structures). Wedding invitation editing is almost always single-user. The collaboration use case is a couple editing together, which happens rarely and can be handled by the existing optimistic locking + lock system.

**Simplification:** Remove all CRDT references. The lock-based two-tab protection + optimistic versioning is sufficient for the foreseeable future. If collaboration becomes a top-10 feature request, design it then.

### O6. Three-Stage Marketplace Safety Pipeline with Lighthouse

**Current design:** Automated scan → sandboxed Lighthouse build → human review.

**Problem:** Running Lighthouse on every marketplace submission requires a headless Chrome instance per build, which is expensive and slow. For a marketplace that will have <50 templates in the first year, this is massive overengineering.

**Simplification:** Stage 1 (automated schema + content validation) is essential. Stage 2 (sandboxed build without Lighthouse) verifies the template renders. Stage 3 (human review) catches everything else. Add Lighthouse when marketplace volume exceeds 100 templates or when automated quality scoring becomes necessary.

### O7. Redis Streams with Priority Lanes

**Current design:** Four priority lanes (P0-P3) in Redis Streams for build jobs.

**Problem:** At 100k users, the publish volume is ~500-1000 builds/day. A simple FIFO queue handles this trivially. Priority lanes add operational complexity (monitoring four streams, XCLAIM logic, dead-letter handling per lane) for a system that won't have contention for months.

**Simplification:** Single Redis list (RPUSH/BLPOP) for build jobs. Add priority lanes when build queue latency exceeds 30 seconds at the 95th percentile. The publish pipeline doc's cost model shows this won't happen until well past 100k users.

---

## 3. Critical Review: Cost Risks

### CR1. Cloudflare Workers Pricing at Scale

**Current assumption (publishing doc §6):** $566/mo at 100k users with $309 Cloudflare cost.

**Risk:** Cloudflare Workers pricing is $0.50/million requests (paid plan) with 10M included. The publishing doc estimates 33M monthly page views at 100k users (330 views/site/month average). This is ~$11.50/mo for Worker invocations alone — reasonable.

**BUT:** Each Worker invocation does a KV read (routing table), an R2 fetch (HTML), and potentially an Analytics Engine write. KV reads are $0.50/million (additional $16.50/mo). R2 reads are $0.36/million Class B operations ($11.88/mo). These compound costs were not itemized in the publishing doc's $309 Cloudflare estimate.

**Revised Cloudflare cost at 100k users:** ~$60/mo (Workers + KV + R2 reads + Analytics Engine). The $309 figure in the publishing doc likely includes the $25/mo Cloudflare Pro plan and Workers Paid plan ($5/mo). Actual infrastructure cost closer to **$400/mo total**, not $566. The original estimate was slightly conservative, which is fine.

**Real cost risk:** Custom domain SSL via Cloudflare for SaaS costs $0.10/hostname/month. At 5,000 Pro/Lifetime users with custom domains, that's $500/mo just for SSL — nearly doubling the infrastructure cost. This was not called out.

**Mitigation:** Gate custom domains behind Pro plan (already done). Monitor hostname count. At scale, consider Caddy/Let's Encrypt on dedicated infrastructure for custom domain SSL ($50/mo fixed vs. $0.10/hostname).

### CR2. PostgreSQL Cost Scaling

**Current assumption:** Neon or Supabase serverless PostgreSQL.

**Risk:** Neon charges for compute (CU-hours) and storage. At 100k users with ~15 tables and JSONB project documents averaging 200KB, storage alone is ~20GB. This is within Neon's free/starter tier. But JSONB queries on the `sections` table (which stores `scene_graph JSONB`) will be compute-intensive during autosave and publish validation.

**Real risk:** The architecture doc stores `scene_graph JSONB` per section row. The monetization doc stores quota counters separately. But the template engine doc's project document is a single multi-megabyte JSON. If the full project document is stored as a single JSONB column (per the simplification in O1), PostgreSQL becomes less suitable for partial updates — every autosave writes the full document.

**Mitigation:** Store the project document in R2 as a JSON file, not in PostgreSQL JSONB. PostgreSQL holds metadata (project ID, slug, owner, version counter, published status). R2 holds the actual document. Autosave writes to R2 (zero egress cost, fast PUT). This eliminates JSONB bloat in PostgreSQL and reduces database size by ~95%.

### CR3. Lifetime Plan Revenue Risk

**Monetization doc (§7.6):** Projects 2,500 lifetime users at $199 each = $497,500 collected.

**Risk:** Lifetime plans create a long-tail liability. These users consume infrastructure indefinitely (published sites served via CDN, media stored in R2, RSVP edge functions processing submissions) with no recurring revenue. If 2,500 lifetime users each have 5 projects with 200MB media, that's 2.5TB of R2 storage at $0.015/GB/mo = $37.50/mo forever. Plus page view serving, RSVP processing, etc.

**The real risk is the ratio:** If lifetime conversions exceed projections (say 10% of paid users instead of 5%), recurring MRR drops while fixed costs grow. The breakeven point shifts.

**Mitigation:** (1) Cap lifetime plan at a version: "Lifetime access to current features. Future premium features may require add-on." (2) Set media storage limit for lifetime at 10GB (already in spec). (3) Monitor lifetime-to-recurring ratio monthly. If lifetime exceeds 30% of paid revenue, adjust pricing or cap availability.

---

## 4. Critical Review: Scaling Risks

### SR1. Single-Worker Build Pipeline

**Current design:** Publish builds run as Cloudflare Workers (or equivalent serverless functions) triggered by the queue.

**Risk:** The render pipeline (15 steps in v1, simplified to 12 in this document) involves: JSON parsing, theme compilation, HTML generation, CSS extraction, JS bundling, image processing (responsive variants), font subsetting, and R2 uploads. This is CPU-intensive work that may exceed Cloudflare Workers' 30-second CPU time limit (or 15 minutes on Durable Objects, which is expensive).

**Real concern:** Step 12 (JS Bundle) and Step 4 (Resolve Assets — generating srcset variants) are the bottlenecks. If a template has 20 images needing 5 responsive variants each, that's 100 image processing operations.

**Mitigation:** Move the build pipeline to a dedicated build worker (Fly.io, Railway, or a simple EC2 spot instance). Cost: ~$20/mo for a single 2-vCPU instance that can handle 500 builds/day. The queue stays in Redis; the worker polls it. This avoids Cloudflare Workers' CPU limits entirely. Keep the CDN serving layer on Cloudflare Workers (which is lightweight: KV read → R2 fetch → HTMLRewriter → response).

### SR2. Single PostgreSQL Database

**Current design:** One PostgreSQL instance for everything — users, projects, subscriptions, media metadata, quota counters, webhook events, billing events.

**Risk:** At 100k users with aggressive autosave (every 2-30 seconds per active editor), the write load on the projects table is the bottleneck. If 5% of users are editing simultaneously, that's 5,000 concurrent autosave writes. Even with the R2 document storage mitigation (CR2), the version counter and metadata updates still hit PostgreSQL.

**Mitigation:** This is fine up to ~500k users on a properly sized instance (Neon Pro or equivalent). Beyond that, shard by tenant_id. But for the 90-day roadmap, a single database is correct — don't prematurely shard.

### SR3. Media Processing at Upload Time

**Current design:** Media service processes uploads synchronously (resize, optimize, generate variants).

**Risk:** A user uploading 20 wedding photos simultaneously triggers 20 × 5 = 100 image processing jobs. If each takes 2 seconds, that's 200 CPU-seconds. On a serverless function, this costs money and may timeout.

**Mitigation:** Process media lazily. On upload, store the original in R2 and generate only the thumbnail synchronously (fast, needed for editor preview). Generate responsive variants (srcset sizes) asynchronously in the background or at publish time (Step 4 of the render pipeline). If a variant is requested before generation, serve the original with Cloudflare Image Resizing ($9/mo for 50k transformations).

---

## 5. Critical Review: Missing Pieces

### M1. No Email Service Design

All five documents reference email notifications (welcome emails, trial ending, payment failed, RSVP responses to project owner, custom domain DNS instructions) but none designs the email system. This is a critical omission for a consumer SaaS product.

**Required:** Transactional email service (Resend, Postmark, or AWS SES). Template-based emails. Event-triggered sends. Unsubscribe handling. At minimum 8 email types needed for launch: welcome, trial-ending, payment-failed, payment-succeeded, project-published, rsvp-received, custom-domain-setup, account-deactivated.

### M2. No Admin Dashboard Design

The monetization doc references "admin dashboard" for manual webhook retry and the abuse prevention section references manual review, but no admin interface is designed. For a SaaS product, you need at minimum: user management, subscription override, content moderation, template approval, and system health monitoring.

### M3. No RSVP/Guestbook API Design

The architecture doc lists RSVP/Guestbook as an "Edge function" but the detailed API is never specified. This is a user-facing feature that needs: form schema validation, rate limiting per the abuse prevention doc, email notification to project owner, guest dietary preference tracking, export to CSV, and a management dashboard within the user's project.

### M4. No Image/Media CDN Strategy

The architecture doc mentions "imgproxy or Cloudflare Images" for image transformation, but the publishing doc's render pipeline (Step 4) generates responsive variants as static files. These two approaches are contradictory — one is dynamic (on-the-fly transformation) and the other is static (pre-generated at build time).

**Resolution:** Use Cloudflare Image Resizing for dynamic transformation in the editor (immediate feedback) and pre-generate static variants at publish time (optimal performance for visitors). Both coexist.

### M5. No Monitoring/Observability Strategy

None of the five documents specify how to monitor system health. For a production SaaS: error tracking (Sentry), uptime monitoring (Uptime Robot or Checkly), log aggregation (Axiom or Logtail), build pipeline observability (queue depth, build duration P50/P95/P99), and real-time alerting.

---

## 6. Simplified Architecture (Resolved)

This section consolidates all five documents into a single consistent architecture, incorporating all resolutions from sections 1-5.

### 6.1 System Topology (Revised)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  Marketing   │  │  Dashboard   │  │  Visual Editor           │  │
│  │  Site (SSG)  │  │  (React SPA) │  │  React + Konva.js        │  │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API LAYER (Cloudflare Workers)                    │
│  Rate Limiting · Auth (JWT) · Tenant Resolution · Quota Middleware   │
│  Feature Gating · Request Routing                                    │
└──────────────────┬──────────────────────────────────┬───────────────┘
                   │                                   │
     ┌─────────────┼─────────────────────┐            │
     ▼             ▼                      ▼            ▼
┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────────────────┐
│ Core API │ │ Build    │ │ Media      │ │ Edge Functions      │
│ (Node)   │ │ Worker   │ │ Service    │ │ (CF Workers)        │
│          │ │ (Fly.io) │ │ (CF +R2)  │ │                     │
│ Auth     │ │          │ │           │ │ RSVP submit         │
│ Projects │ │ Render   │ │ Upload    │ │ Guestbook           │
│ Templates│ │ pipeline │ │ Optimize  │ │ Page analytics      │
│ Billing  │ │ 12-step  │ │ Serve     │ │ Site serving        │
│ Admin    │ │ build    │ │           │ │ Watermark injection │
└────┬─────┘ └────┬─────┘ └─────┬─────┘ └──────────┬─────────┘
     │            │              │                   │
     ▼            ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  PostgreSQL   │  │  Redis       │  │  Cloudflare   │             │
│  │  (Neon)       │  │  (Upstash)   │  │  R2 + KV      │             │
│  │               │  │              │  │               │             │
│  │  Users        │  │  Sessions    │  │  Project docs │             │
│  │  Tenants      │  │  Rate limits │  │  (JSON files) │             │
│  │  Subscriptions│  │  Quotas      │  │  Media files  │             │
│  │  Plans +      │  │  Build queue │  │  Published    │             │
│  │  Entitlements │  │  Entitlement │  │  static sites │             │
│  │  Metadata     │  │  cache       │  │  Template     │             │
│  │  Webhook log  │  │              │  │  assets       │             │
│  │  Billing      │  │              │  │               │             │
│  │  events       │  │              │  │  KV: routing  │             │
│  └──────────────┘  └──────────────┘  │  table, DNS   │             │
│                                       │  map, plan    │             │
│                                       │  cache        │             │
│                                       └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

**Key change from v1:** Project documents (the four-layer JSON) are stored in R2 as JSON files, not in PostgreSQL JSONB. PostgreSQL holds only relational metadata. This dramatically reduces database size and write load.

### 6.2 Subsystem Boundaries (Revised)

| Subsystem | Responsibility | Deployment | Communication |
|---|---|---|---|
| **Core API** | Auth, projects, templates, subscriptions, admin | Node.js on Fly.io (or Railway) | REST + tRPC |
| **Build Worker** | 12-step render pipeline, queue consumer | Fly.io (2-vCPU machine) | Redis queue → R2 output |
| **Media Service** | Upload, validate, thumbnail, serve | Cloudflare Worker + R2 | REST API (presigned URLs) |
| **Edge Functions** | RSVP, guestbook, analytics, site serving, watermark | Cloudflare Workers | Edge-native |
| **Billing Service** | Stripe webhooks, entitlement sync | Internal module within Core API | Webhooks + direct |
| **Email Service** | Transactional emails | Resend API | Event-triggered |

**Simplification from v1:** Removed the "Render Engine" as a separate subsystem. The render pipeline runs on the Build Worker. The editor's live preview runs client-side using the editor renderer (separate from the static renderer). No separate "Render Engine" deployment.

---

## 7. Unified Data Model

### 7.1 PostgreSQL Schema (Authoritative)

This replaces ALL schema definitions across the five documents. Any table not listed here does not exist.

```sql
-- IDENTITY
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT NOT NULL UNIQUE,           -- {slug}.elove.me
    name            TEXT NOT NULL,
    device_fingerprint TEXT,                        -- abuse detection
    trust_score     INTEGER NOT NULL DEFAULT 50,    -- 0-100
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    password_hash   TEXT,                           -- NULL if OAuth-only
    oauth_provider  TEXT,
    oauth_id        TEXT,
    role            TEXT NOT NULL DEFAULT 'owner',  -- owner | editor (future)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PLANS & SUBSCRIPTIONS (three-tier + entitlements model)
CREATE TABLE plans (
    id              TEXT PRIMARY KEY,               -- 'free' | 'pro' | 'lifetime'
    name            TEXT NOT NULL,
    billing_type    TEXT NOT NULL,                   -- 'free' | 'recurring' | 'one_time'
    price_monthly   INTEGER,                        -- cents
    price_yearly    INTEGER,                        -- cents
    price_lifetime  INTEGER,                        -- cents
    stripe_price_ids JSONB NOT NULL DEFAULT '{}',
    sort_order      INTEGER NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plan_entitlements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         TEXT NOT NULL REFERENCES plans(id),
    feature_key     TEXT NOT NULL,
    value           TEXT NOT NULL,                   -- all values as TEXT, app-level coercion
    UNIQUE(plan_id, feature_key)
);
CREATE INDEX idx_entitlements_plan ON plan_entitlements(plan_id);

CREATE TABLE entitlement_overrides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    feature_key     TEXT NOT NULL,
    value           TEXT NOT NULL,
    reason          TEXT NOT NULL,
    expires_at      TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, feature_key)
);

CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL UNIQUE REFERENCES tenants(id),
    plan_id                 TEXT NOT NULL REFERENCES plans(id),
    billing_type            TEXT NOT NULL,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    stripe_payment_intent_id TEXT,
    status                  TEXT NOT NULL DEFAULT 'active',
    -- enum: active | past_due | canceled | trialing | lifetime | grace_period
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at               TIMESTAMPTZ,
    grace_period_end        TIMESTAMPTZ,
    trial_end               TIMESTAMPTZ,
    referral_code           TEXT UNIQUE,
    referred_by             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROJECTS (metadata only — document JSON lives in R2)
CREATE TABLE projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    created_by              UUID NOT NULL REFERENCES users(id),
    slug                    TEXT NOT NULL,
    title                   TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft',
    -- enum: draft | published | archived
    template_id             TEXT,                    -- original template ID (seed)
    template_version        INTEGER,                -- version at creation time
    r2_document_key         TEXT NOT NULL,           -- R2 path to project JSON
    edit_revision           INTEGER NOT NULL DEFAULT 0,
    publish_version         INTEGER NOT NULL DEFAULT 0,
    published_at            TIMESTAMPTZ,
    seo_meta                JSONB NOT NULL DEFAULT '{}',
    settings                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_slug ON projects(slug);

-- MEDIA (metadata — files in R2)
CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    project_id      UUID REFERENCES projects(id),
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    r2_key          TEXT NOT NULL,
    dimensions      JSONB,                          -- { width, height }
    blurhash        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_tenant ON media(tenant_id);

-- TEMPLATES (marketplace)
CREATE TABLE templates (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    author_tenant_id UUID REFERENCES tenants(id),   -- NULL for system templates
    status          TEXT NOT NULL DEFAULT 'draft',
    -- enum: draft | review | published | rejected
    is_system       BOOLEAN NOT NULL DEFAULT false,
    metadata        JSONB NOT NULL DEFAULT '{}',
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     TEXT NOT NULL REFERENCES templates(id),
    version         INTEGER NOT NULL,
    r2_bundle_key   TEXT NOT NULL,                   -- R2 path to template bundle
    schema_version  INTEGER NOT NULL DEFAULT 1,
    changelog       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(template_id, version)
);

-- PUBLISHED SITES
CREATE TABLE published_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    publish_version INTEGER NOT NULL,
    r2_prefix       TEXT NOT NULL,                   -- R2 path to published files
    build_hash      TEXT NOT NULL,
    source_edit_revision INTEGER NOT NULL,           -- which edit_revision was published
    build_duration_ms INTEGER,
    status          TEXT NOT NULL DEFAULT 'building',
    -- enum: building | live | superseded | failed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, publish_version)
);

-- CUSTOM DOMAINS
CREATE TABLE custom_domains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    hostname        TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- enum: pending | verifying | active | failed | disconnected
    cf_hostname_id  TEXT,                            -- Cloudflare for SaaS ID
    ssl_status      TEXT DEFAULT 'pending',
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RSVP
CREATE TABLE rsvp_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    guest_name      TEXT NOT NULL,
    email           TEXT,
    attending        TEXT NOT NULL,                   -- 'yes' | 'no' | 'maybe'
    party_size      INTEGER DEFAULT 1,
    meal_choice     TEXT,
    dietary_notes   TEXT,
    custom_answers  JSONB DEFAULT '{}',
    is_over_quota   BOOLEAN DEFAULT false,           -- soft quota marker
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rsvp_project ON rsvp_responses(project_id);

-- GUESTBOOK
CREATE TABLE guestbook_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    author_name     TEXT NOT NULL,
    message         TEXT NOT NULL,
    is_approved     BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- QUOTA TRACKING
CREATE TABLE quota_usage (
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    quota_key       TEXT NOT NULL,
    current_value   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, quota_key)
);

-- BILLING
CREATE TABLE webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'processing',
    error_message   TEXT,
    attempts        INTEGER DEFAULT 1,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE billing_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    event_type      TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_events_tenant ON billing_events(tenant_id);
```

**Tables removed from v1:** `sections` (scene_graph JSONB moved to R2), `pages` (absorbed into project document in R2), `page_views` (replaced by Cloudflare Analytics Engine).

**Key changes:**
- Project documents stored in R2, not PostgreSQL JSONB
- Single `value TEXT` column in entitlements instead of three typed columns
- Explicit `grace_period` status in subscriptions
- `edit_revision` and `publish_version` named consistently
- `is_over_quota` flag on RSVP responses for soft quota tracking

### 7.2 R2 Object Layout (Authoritative)

```
projects/{tenant_id}/{project_id}/
  document.json                    -- the project document (structure + content + behavior)
  theme.json                       -- resolved theme with overrides

media/{tenant_id}/{media_id}/
  original.{ext}                   -- original upload
  thumb.webp                       -- 200px thumbnail (generated on upload)
  (responsive variants generated at publish time or on-demand via CF Image Resizing)

templates/{template_id}/v{version}/
  bundle.json                      -- full template (structure + default theme + default behavior)
  assets/                          -- decorative SVGs, Lottie files, default images

published/{project_id}/v{version}/
  index.html                       -- per page
  {page-slug}.html                 -- additional pages
  style.{hash}.css
  shared.{hash}.js
  {island}.{hash}.js
  assets/                          -- content-hashed images, fonts

shared/
  vendor/gsap.3.12.min.js
  islands/{hash}/                  -- shared island scripts across templates
```

---

## 8. Unified Rendering + Publishing Pipeline

### 8.1 Two Render Paths (Clarified)

**Editor render loop (client-side, synchronous, ~16ms budget):**
1. Read document from Document Store
2. Resolve theme tokens → CSS custom properties on canvas container
3. For each section: invoke editor renderer (DOM for stack/grid, Konva for free layout)
4. Apply interaction overlay (selection, drag handles, snap guides)

No HTML assembly, no JS bundling, no asset hashing. The editor renders live DOM/canvas, not static HTML.

**Publish render pipeline (server-side, async, 12 steps, ~10-60s):**

Simplified from the original 15 steps by merging related steps:

| Phase | Steps | Description | Time Budget |
|---|---|---|---|
| **Resolve** | 1. Snapshot + Merge | Freeze document, merge all layers into resolved tree | 500ms |
| | 2. Bind Content | Resolve data bindings, format dates, apply fallbacks | 200ms |
| | 3. Resolve Assets | Map media IDs → CDN URLs, generate srcset, blurhash | 2s |
| | 4. Compile Theme | Tokens → CSS custom properties, @font-face, responsive overrides | 200ms |
| **Compile** | 5. Layout + Render | Section CSS (flexbox/grid/absolute) + element HTML via static renderers | 3s |
| | 6. Animation Compile | Behavior layer → CSS @keyframes + data attributes + reduced-motion variants | 500ms |
| | 7. Responsive Compile | Mobile overrides → @media blocks | 200ms |
| | 8. Islands Extract | Identify dynamic components → generate island script tags | 200ms |
| **Package** | 9. CSS Extract + Critical Split | Deduplicate, split critical (above-fold) vs deferred | 300ms |
| | 10. JS Bundle | Tree-shake islands, bundle shared utilities | 1s |
| | 11. HTML Assemble | Build final HTML per page with inlined critical CSS | 500ms |
| | 12. Asset Hash + Upload | Content-hash all files, parallel upload to R2, update KV routing | 3s |

Total: ~12s typical, 60s hard timeout.

**Simplification from v1:** Merged "Snapshot" and "Merge Layers" into one step (they're always sequential). Merged "Section Layout" and "Element Render" (they're tightly coupled). Reduced from 15 to 12 steps. Removed "Dynamic Islands" as a separate step — it's part of element rendering.

### 8.2 Publish State Machine (Unchanged)

The 7-state machine from the publishing doc is correct as-is: IDLE → VALIDATING → SNAPSHOT → QUEUED → BUILDING → DEPLOYING → LIVE, with FAILED branching from VALIDATING, BUILDING, or DEPLOYING.

### 8.3 Build Queue (Simplified)

Single Redis list. No priority lanes for MVP.

```
Queue: build_jobs (Redis LIST)

  RPUSH build_jobs {
    build_id: UUID,
    project_id: UUID,
    tenant_id: UUID,
    publish_version: integer,
    source_edit_revision: integer,
    document_r2_key: string,
    queued_at: ISO timestamp
  }

  Build Worker: BLPOP build_jobs (blocking pop, 30s timeout)

  On build start: SET build:{build_id}:heartbeat (15s TTL, refreshed every 10s)
  On timeout: if heartbeat expired, job is re-queued (max 2 retries)
```

---

## 9. Unified Editor Architecture

### 9.1 Document Model (Simplified)

```
ProjectDocument {
  structure: {
    pages: Page[]
    globalSlots: { navigation, musicPlayer, footer }
  }
  content: {
    data: { couple, event, story, gallery, rsvp, music }
    slotContent: { [slotId]: SlotContent }
    customSections: CustomSection[]
  }
  behavior: {
    sectionBehaviors: { [sectionId]: SectionBehavior }
    pageTransitions: TransitionConfig
    globalBehaviors: GlobalBehaviorConfig
    accessibilityFallback: AccessibilityConfig
  }
}

Theme {
  baseThemeId: string
  tokens: ThemeTokens         -- full resolved token set
  overrides: Partial<ThemeTokens>  -- user customizations
}
```

Two top-level entities. Theme is separate (swappable). Everything else is the ProjectDocument.

### 9.2 Command Set (MVP — 12 commands)

| Command | Layer | Payload |
|---|---|---|
| `UPDATE_CONTENT` | content | `{ path: string, value: any }` (JSON path into content) |
| `UPDATE_THEME_TOKEN` | theme | `{ tokenPath: string, value: any }` |
| `SWITCH_THEME` | theme | `{ themeId: string }` |
| `ADD_SECTION` | structure | `{ pageId, afterSectionId, sectionType }` |
| `REMOVE_SECTION` | structure | `{ pageId, sectionId }` |
| `REORDER_SECTION` | structure | `{ pageId, sectionId, targetIndex }` |
| `ADD_PAGE` | structure | `{ slug, title }` |
| `REMOVE_PAGE` | structure | `{ pageId }` |
| `REORDER_PAGE` | structure | `{ pageId, targetIndex }` |
| `UPDATE_LAYOUT` | structure | `{ sectionId, patch }` |
| `UPDATE_ANIMATION` | behavior | `{ sectionId, slotId, config }` |
| `UPDATE_META` | meta | `{ field, value }` (SEO, settings, music) |

Undo/redo: full document snapshots with structural sharing (unchanged from editor doc). 100-step limit.

### 9.3 Autosave (Simplified)

**Document is stored in R2 as JSON.** Autosave writes the full document to R2 (not a diff). R2 PUT is fast (<100ms for a 200KB JSON file) and costs $0 for egress.

```
Autosave flow:
  Command executed → dirty flag set
  → 2s debounce (5s if typing, 30s forced max)
  → Compare document hash vs lastSavedHash
  → If different:
      PUT r2://projects/{tenant_id}/{project_id}/document.json
      PATCH /api/projects/{id} { edit_revision: current+1 }
  → Update lastSavedHash, edit_revision
```

This eliminates the layer-level delta computation from the editor doc (§6.1). Full-document R2 PUT is simpler and fast enough.

### 9.4 Conflict Resolution (Simplified)

With the two-entity model (document + theme), conflicts are simpler:

- **Same entity, different sources:** Show conflict dialog (keep mine / keep server / review)
- **Different entities:** Auto-merge (local document + server theme or vice versa)
- **Two-tab protection:** BroadcastChannel + server lock (unchanged from editor doc)

---

## 10. Unified Monetization Model

### 10.1 Three Plans

| | Free | Pro ($12/mo, $99/yr) | Lifetime ($199) |
|---|---|---|---|
| Projects | 1 | 5 | Unlimited |
| Pages/project | 3 | Unlimited | Unlimited |
| RSVP | 50 (soft) | 500 (soft) | Unlimited |
| Media | 50 MB | 2 GB | 10 GB |
| Custom domain | No | Yes | Yes |
| Branding badge | Yes | No | No |
| AI features | No | Yes | Yes |
| Template access | Free only | All | All + early access |
| Analytics | Basic (views only) | Full (geo, device, referrer) | Full |
| Publish/day | 3 | 20 | Unlimited |
| Sections/page | 8 | Unlimited | Unlimited |

### 10.2 Feature Gating: Three Layers

1. **Client (UI):** `<FeatureGate>` component reads from `EntitlementContext`. Hides/disables gated UI. Not a security boundary.
2. **API (Middleware):** Loads entitlements from Redis (5min cache) → falls back to DB. Returns 403 + `upgrade_required` for gated operations.
3. **Edge (Publish/Serve):** Publish pipeline re-validates entitlements. CDN Worker injects branding badge for free plan via HTMLRewriter.

### 10.3 Quota Enforcement

Two types: **hard** (403 block) and **soft** (accept with warning flag).

Redis atomic counters are the real-time source. PostgreSQL `quota_usage` table is the durable reconciliation store. Cron reconciles every 15 minutes.

### 10.4 Stripe Integration

Unchanged from monetization doc. Key flows: Checkout Sessions for new subscriptions and lifetime payments. Customer Portal for self-service management. Webhooks for state sync (8 event types handled). Idempotent webhook processing via `webhook_events` table.

### 10.5 Grace Period

14 days after subscription cancellation. Lifetime refund = immediate downgrade. Features remain active during grace period. Published sites keep serving but gain badge after grace period ends.

---

## 11. Revised Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend framework** | Next.js 15 (App Router) | SSG for marketing, SPA for dashboard, shared React components |
| **Editor canvas** | Konva.js (free-layout), DOM (stack/grid) | Dual renderer strategy. No Fabric.js. |
| **API** | tRPC on Node.js | End-to-end type safety with TypeScript frontend |
| **Build worker** | Node.js on Fly.io (2-vCPU) | Dedicated compute for render pipeline. Avoids CF Workers CPU limits. |
| **Edge functions** | Cloudflare Workers | Site serving, RSVP, guestbook, analytics, watermark injection |
| **Database** | Neon PostgreSQL | Serverless scaling, branching for dev/staging, connection pooling |
| **Cache/Queue** | Upstash Redis | Serverless Redis. Sessions, rate limits, quota counters, build queue. |
| **Object storage** | Cloudflare R2 | Zero egress. Project documents, media, published sites, templates. |
| **CDN/DNS** | Cloudflare (Pro plan) | Global CDN, KV for routing, Workers for serving, for SaaS for custom domains |
| **Payments** | Stripe Billing | Subscriptions, one-time payments, Customer Portal, webhooks |
| **Email** | Resend | Transactional email. React Email templates. 3k free/mo then $20/mo. |
| **Monitoring** | Sentry + Axiom + Checkly | Error tracking, log aggregation, uptime monitoring |
| **Media processing** | CF Image Resizing + Sharp (build) | On-demand transforms in editor, static variants at publish time |
| **Animation** | GSAP (published sites) | CDN-hosted. Not bundled — loaded as external script. |

**Removed from v1:** Fabric.js (redundant with Konva), separate "Render Engine" service (absorbed into Build Worker), Redis Streams (simplified to list).

---

## 12. Revised 90-Day Roadmap

### Phase 1: Foundation (Days 1-30)

```
WEEK 1-2: Infrastructure + Schema
├── PostgreSQL schema (this document §7.1)
├── R2 bucket structure (§7.2)
├── Cloudflare Workers project (site serving + edge functions)
├── Auth: email/password + Google OAuth
├── Tenant/user CRUD
└── CI/CD pipeline (GitHub Actions → Fly.io + Cloudflare)

WEEK 3-4: Template Engine + Editor Shell
├── Project document model (§9.1)
├── Template creation tooling (bundle → R2)
├── 3 system templates (elegant, minimal, playful)
├── Editor shell (toolbar, page tree, section navigator, property panel)
├── DOM renderer for stack layout sections
├── 6 core commands: UPDATE_CONTENT, ADD_SECTION, REMOVE_SECTION,
│   REORDER_SECTION, UPDATE_THEME_TOKEN, UPDATE_META
├── Autosave to R2
└── Undo/redo (snapshot-based)
```

### Phase 2: Editor + Media (Days 31-60)

```
WEEK 5-6: Editor Depth
├── Konva renderer for free-layout sections
├── Remaining 6 commands
├── Three-level validation (command, background, publish-gate)
├── Mobile preview (responsive override resolution)
├── Text editing (controlled contentEditable)
├── Media upload (presigned URL → R2, thumbnail generation)
└── Component registry: text, image, video, shape, button, icon, divider

WEEK 7-8: Interactive Components + Theme
├── Countdown island
├── RSVP form (edge function + database)
├── Guestbook (edge function + database)
├── Gallery (lightbox island)
├── Music player island
├── Theme switching (live preview in editor)
├── Scroll animation (IntersectionObserver island)
└── Map component (lazy Google Maps)
```

### Phase 3: Publishing + Billing + Launch (Days 61-90)

```
WEEK 9-10: Publishing Pipeline
├── Build Worker on Fly.io
├── 12-step render pipeline
├── R2 upload + KV routing table update
├── CDN serving Worker (resolve → fetch → serve)
├── Subdomain routing ({slug}.elove.me)
├── Cache strategy (immutable hashed assets, short-TTL index.html)
├── Branding badge injection (HTMLRewriter)
└── Cloudflare Analytics Engine (zero-JS pageview tracking)

WEEK 11-12: Billing + Launch Prep
├── Stripe integration: plans, checkout sessions, customer portal
├── Webhook handler (8 event types, idempotent processing)
├── Entitlement middleware + Redis cache
├── Quota enforcement (hard + soft quotas)
├── Feature gating (client FeatureGate component + API middleware)
├── Grace period logic + trial system
├── Transactional email (8 templates via Resend)
├── Custom domain setup (Cloudflare for SaaS API)
├── Admin dashboard (user management, content moderation, system health)
├── Monitoring (Sentry, Axiom, Checkly)
└── Beta launch: 3 templates, 3 plan tiers, subdomain publishing
```

### Milestones

| Day | Milestone |
|---|---|
| 14 | Auth + project CRUD + R2 document storage working |
| 21 | Editor renders stack-layout template with text editing |
| 35 | Full editor with both renderers, all commands, autosave |
| 45 | Media upload, RSVP form, guestbook functional |
| 60 | Theme switching, all interactive components working |
| 70 | Publish pipeline produces live static sites |
| 80 | Stripe billing, feature gating, quota enforcement active |
| 85 | Custom domains, transactional emails, admin dashboard |
| 90 | **Beta launch** |

### Post-Launch (Day 91+)

Not in scope for this blueprint but noted for sequencing:

- Template marketplace (Stage 1 + 2 safety pipeline, human review)
- AI content injection (text generation, image enhancement)
- Referral system (schema ready, activation deferred)
- Priority build lanes (when queue latency exceeds 30s P95)
- Lighthouse in marketplace pipeline (when >100 templates)
- Advanced analytics (geo breakdown, device breakdown)
- CRDT collaboration (if top-10 feature request)

---

## Appendix: Contradiction Resolution Matrix

| ID | Contradiction | Resolution | Affected Docs |
|---|---|---|---|
| C1 | 4 tiers vs 3 tiers | 3 tiers (free/pro/lifetime) | arch, editor, monetization |
| C2 | Fabric.js vs Konva.js | Konva.js only | arch |
| C3 | Column-based plans vs entitlement table | Entitlement table with single TEXT value column | arch, monetization |
| C4 | 4 subscription statuses vs 5 | 6 statuses (added lifetime + grace_period) | arch, monetization |
| C5 | Hard-only quotas vs soft RSVP | Hard + soft quota types | arch, monetization |
| C6 | Ambiguous version naming | edit_revision + publish_version + save_point_id | editor, publishing |
| C7 | Editor render path unspecified | Separate editor render loop (4 steps) vs publish pipeline (12 steps) | template, editor, publishing |

## Appendix: Overengineering Removal Summary

| ID | Feature Removed/Simplified | Savings | Reintroduce When |
|---|---|---|---|
| O1 | Four independent layers → two entities | ~40% less state management complexity | Never (conceptual layers preserved internally) |
| O2 | A/B variant system (JSON Patch) | ~2 weeks dev time, ongoing pipeline complexity | User demand for A/B testing |
| O3 | Copy-on-write template dedup | Eliminated pointer/copy state machine | Never ($0.05/mo savings not worth complexity) |
| O4 | 35 commands → 12 | ~60% less command boilerplate | As editor features mature |
| O5 | Yjs CRDT collaboration | Removed CRDT-compatible constraints on document model | Top-10 feature request |
| O6 | Lighthouse in marketplace pipeline | Removed headless Chrome requirement | >100 marketplace templates |
| O7 | Redis Streams priority lanes → single list | Simpler operations | Build queue latency >30s P95 |
