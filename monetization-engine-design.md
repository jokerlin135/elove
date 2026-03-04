# ELove Monetization Engine — System Design

**Version:** 1.0
**Date:** March 3, 2026
**Scope:** The complete billing, subscription, feature gating, quota enforcement, and conversion optimization system for the ELove SaaS wedding invitation platform.
**Prerequisites:** `architecture-saas-wedding-platform.md` (schema, API boundaries, billing service), `publishing-engine-design.md` (watermark injection via HTMLRewriter, quota checks in publish pipeline)

---

## Table of Contents

1. Plan Structure Design
2. Feature Gating Architecture
3. Quota Enforcement Strategy
4. Billing Event Handling Flow
5. Abuse Prevention Strategy
6. Metrics to Track for Optimization
7. Conversion Leverage Points

---

## 1. Plan Structure Design

### 1.1 Plan Tiers

The architecture doc defined four tiers (free/starter/pro/business). This design revises to three tiers plus a lifetime option, based on wedding SaaS market dynamics: couples are one-time buyers with a 6-12 month purchase window, making a simpler tier structure with a lifetime option commercially superior.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PLAN STRUCTURE                                        │
│                                                                                 │
│  ┌───────────────┐    ┌──────────────────┐    ┌────────────────────────────┐   │
│  │  FREE          │    │  PRO              │    │  LIFETIME                  │   │
│  │                │    │                   │    │                            │   │
│  │  $0/forever    │    │  $12/mo or $99/yr │    │  $199 one-time             │   │
│  │                │    │                   │    │                            │   │
│  │  1 project     │    │  5 projects       │    │  Unlimited projects        │   │
│  │  3 pages/proj  │    │  Unlimited pages  │    │  Unlimited pages           │   │
│  │  50 RSVP       │    │  500 RSVP         │    │  Unlimited RSVP            │   │
│  │  50 MB media   │    │  2 GB media       │    │  10 GB media               │   │
│  │  *.elove.me    │    │  Custom domain    │    │  Custom domain             │   │
│  │  ELove badge   │    │  No badge         │    │  No badge                  │   │
│  │  Basic stats   │    │  Full analytics   │    │  Full analytics            │   │
│  │  No AI         │    │  AI features      │    │  AI features               │   │
│  │  5 templates   │    │  All templates    │    │  All templates + early     │   │
│  │                │    │                   │    │  access                    │   │
│  └───────────────┘    └──────────────────┘    └────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Revised Schema

The original `plans` table stored all limits as columns. This works for three tiers but becomes brittle as feature flags grow. The revised design separates plan definition from feature entitlements:

```
plans
├── id                TEXT PK           -- 'free' | 'pro' | 'lifetime'
├── name              TEXT NOT NULL
├── billing_type      TEXT NOT NULL     -- 'free' | 'recurring' | 'one_time'
├── price_monthly     INTEGER           -- cents, NULL for free/lifetime
├── price_yearly      INTEGER           -- cents, NULL for free/lifetime
├── price_lifetime    INTEGER           -- cents, NULL for free/recurring
├── stripe_price_ids  JSONB NOT NULL    -- {"monthly": "price_xxx", "yearly": "price_yyy", "lifetime": "price_zzz"}
├── sort_order        INTEGER NOT NULL  -- display ordering
├── is_active         BOOLEAN DEFAULT true
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

plan_entitlements
├── id                UUID PK
├── plan_id           TEXT FK → plans(id)
├── feature_key       TEXT NOT NULL     -- 'max_projects' | 'custom_domain' | 'ai_features' | ...
├── value_type        TEXT NOT NULL     -- 'integer' | 'boolean' | 'string'
├── value_int         INTEGER           -- for numeric limits
├── value_bool        BOOLEAN           -- for feature flags
├── value_str         TEXT              -- for tier strings ('basic'|'advanced')
└── UNIQUE(plan_id, feature_key)

-- Index for fast entitlement loading
CREATE INDEX idx_plan_entitlements_plan ON plan_entitlements(plan_id);
```

**Why separate entitlements from plans?** Three reasons: (1) adding a new feature flag is an INSERT, not an ALTER TABLE; (2) A/B testing different limits per plan requires no schema change; (3) the entitlement table becomes the single source of truth that both the API middleware and the client UI read from.

### 1.3 Entitlement Matrix

| Feature Key | Free | Pro | Lifetime |
|---|---|---|---|
| `max_projects` | 1 | 5 | -1 (unlimited) |
| `max_pages_per_project` | 3 | -1 | -1 |
| `max_rsvp` | 50 | 500 | -1 |
| `max_media_bytes` | 52428800 (50MB) | 2147483648 (2GB) | 10737418240 (10GB) |
| `custom_domain` | false | true | true |
| `remove_branding` | false | true | true |
| `ai_features` | false | true | true |
| `analytics_tier` | 'basic' | 'advanced' | 'advanced' |
| `template_access` | 'free_only' | 'all' | 'all_plus_early' |
| `max_publish_per_day` | 3 | 20 | -1 |
| `priority_build` | false | true | true |
| `password_protect` | false | true | true |
| `custom_css` | false | false | true |
| `export_html` | false | false | true |

Convention: `-1` means unlimited. This avoids NULL semantics and simplifies comparisons in middleware (`if limit !== -1 && usage >= limit`).

### 1.4 Lifetime Plan — Billing Mechanics

The lifetime plan is a one-time Stripe Checkout payment, not a subscription. This creates a distinct billing entity:

```
subscriptions (revised)
├── id                    UUID PK
├── tenant_id             UUID FK UNIQUE → tenants(id)
├── plan_id               TEXT FK → plans(id)
├── billing_type          TEXT NOT NULL      -- mirrors plans.billing_type
├── stripe_customer_id    TEXT
├── stripe_subscription_id TEXT              -- NULL for lifetime
├── stripe_payment_intent_id TEXT           -- NULL for recurring, set for lifetime
├── status                TEXT NOT NULL      -- 'active' | 'past_due' | 'canceled' | 'trialing' | 'lifetime'
├── current_period_start  TIMESTAMPTZ        -- NULL for lifetime
├── current_period_end    TIMESTAMPTZ        -- NULL for lifetime (no expiry)
├── cancel_at             TIMESTAMPTZ        -- scheduled cancellation
├── canceled_at           TIMESTAMPTZ        -- actual cancellation timestamp
├── grace_period_end      TIMESTAMPTZ        -- NULL unless in grace period
├── trial_end             TIMESTAMPTZ
├── referral_code         TEXT UNIQUE        -- for referral system
├── referred_by           TEXT               -- referral_code of referrer
├── created_at            TIMESTAMPTZ
└── updated_at            TIMESTAMPTZ
```

**Lifetime status lifecycle:**
```
checkout.session.completed (mode: 'payment')
  → INSERT subscription with status = 'lifetime', billing_type = 'one_time'
  → stripe_subscription_id = NULL
  → current_period_end = NULL (never expires)
```

**Refund handling:** If a lifetime payment is refunded via Stripe (`charge.refunded`), the system downgrades to free plan immediately. No grace period for refunded lifetime plans — the value was already delivered at a discount.

### 1.5 Trial Strategy

7-day free trial of Pro, no credit card required. On day 5, in-app nudge + email. On day 7, auto-downgrade to free plan. Projects created during trial retain their content but lose Pro features (badge appears, custom domain disconnected, excess RSVP responses become read-only).

```
Trial state machine:

  signup → status='trialing', plan_id='pro', trial_end=now()+7d
    │
    ├─ day 5 → trigger trial_ending_soon notification
    │
    ├─ converts before day 7 → status='active', clear trial_end
    │
    └─ day 7 passes → cron: downgrade to free
         │
         ├─ excess projects → mark as 'archived' (visible but not editable)
         ├─ published sites → inject branding badge
         ├─ custom domains → disconnect (DNS records become orphaned)
         └─ analytics → downgrade to basic tier
```

---

## 2. Feature Gating Architecture

### 2.1 Three-Layer Gating Model

Feature gating operates at three distinct enforcement points, each catching different violation vectors:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE GATING LAYERS                                │
│                                                                             │
│  LAYER 1: CLIENT-SIDE (UI Gating)                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  • Hide/disable UI elements based on entitlements                    │  │
│  │  • Show upgrade prompts in place of gated features                   │  │
│  │  • Loaded once on auth, cached in React context                      │  │
│  │  • NOT a security boundary — visual guidance only                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  LAYER 2: API-SIDE (Middleware Gating)                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  • Centralized middleware on every mutating API route                 │  │
│  │  • Loads entitlements from Redis cache (5min TTL) → falls back to DB │  │
│  │  • Returns 403 + upgrade_required error with specific feature_key    │  │
│  │  • THE authoritative enforcement point                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  LAYER 3: EDGE (Publish-Time Gating)                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  • Publish pipeline re-validates all entitlements before build        │  │
│  │  • HTMLRewriter injects branding badge for free plan at CDN edge      │  │
│  │  • CDN Worker checks subscription status on every page serve         │  │
│  │  • Catches stale state (subscription canceled between editor save    │  │
│  │    and publish, or between publish and serve)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Entitlement Resolution Pipeline

```
Request arrives
  │
  ▼
Auth middleware extracts tenant_id from JWT
  │
  ▼
Entitlement middleware:
  │
  ├─ 1. Check Redis: entitlements:{tenant_id} (hash of feature_key → value)
  │     Hit? → Use cached entitlements
  │     Miss? ↓
  │
  ├─ 2. Query: SELECT pe.feature_key, pe.value_type, pe.value_int, pe.value_bool, pe.value_str
  │             FROM subscriptions s
  │             JOIN plan_entitlements pe ON pe.plan_id = s.plan_id
  │             WHERE s.tenant_id = $1 AND s.status IN ('active','trialing','lifetime')
  │
  ├─ 3. Hydrate into EntitlementMap: Map<feature_key, resolved_value>
  │
  ├─ 4. Write to Redis with 5min TTL
  │
  └─ 5. Attach to request context: req.entitlements
```

**Entitlement override table** (for grandfathered users, beta testers, partnerships):

```
entitlement_overrides
├── id             UUID PK
├── tenant_id      UUID FK → tenants(id)
├── feature_key    TEXT NOT NULL
├── value_type     TEXT NOT NULL
├── value_int      INTEGER
├── value_bool     BOOLEAN
├── value_str      TEXT
├── reason         TEXT NOT NULL     -- 'beta_tester' | 'partnership' | 'grandfathered' | 'support_override'
├── expires_at     TIMESTAMPTZ       -- NULL = permanent
├── created_by     UUID FK → users(id)
├── created_at     TIMESTAMPTZ
└── UNIQUE(tenant_id, feature_key)
```

Resolution order: override (if exists and not expired) → plan entitlement → default (free tier). This allows support to grant a single user custom domain access without changing their plan.

### 2.3 Client-Side Entitlement Delivery

The entitlement map is delivered to the client via the `/api/auth/session` endpoint (called on app load):

```
GET /api/auth/session → {
  user: { id, email, name },
  tenant: { id, slug },
  subscription: { plan_id, status, billing_type },
  entitlements: {
    max_projects: 1,
    max_pages_per_project: 3,
    custom_domain: false,
    remove_branding: false,
    ai_features: false,
    ...
  },
  usage: {
    projects: 1,
    media_bytes: 12400000,
    rsvp_count: 12,
    publishes_today: 1
  }
}
```

React context provider wraps the entire editor:

```
EntitlementContext
  ├── canUse(featureKey) → boolean
  ├── getLimit(featureKey) → number | -1
  ├── getUsage(featureKey) → number
  ├── isAtLimit(featureKey) → boolean
  ├── upgradePromptFor(featureKey) → { title, description, cta, planRequired }
  └── refresh() → re-fetch from server (called after plan change)
```

Every gated UI element uses a single pattern:

```
<FeatureGate feature="custom_domain" fallback={<UpgradePrompt feature="custom_domain" />}>
  <CustomDomainSettings />
</FeatureGate>
```

### 2.4 Watermark Injection

The "Made with ELove" badge is injected at the CDN edge, not in source HTML. This prevents removal by inspecting the published HTML.

```
Injection point: Cloudflare Worker serving published sites

Worker logic (pseudocode):
  1. Resolve hostname → tenant_id → subscription status
  2. If plan_id = 'free' OR status NOT IN ('active','lifetime'):
       response = HTMLRewriter()
         .on('body', { element(el) {
           el.append(BADGE_HTML, { html: true })
         }})
         .transform(response)
  3. Badge HTML:
       <div id="elove-badge" style="
         position:fixed; bottom:16px; right:16px; z-index:9999;
         background:#fff; border-radius:24px; padding:6px 14px;
         box-shadow:0 2px 8px rgba(0,0,0,0.15); font-family:system-ui;
         font-size:13px; color:#333; text-decoration:none;
         display:flex; align-items:center; gap:6px;
         pointer-events:auto;
       ">
         <svg width="16" height="16">...</svg>
         Made with ELove
       </div>
  4. Badge links to elove.me/?ref={tenant_slug} (attribution + viral acquisition)
```

**Anti-tamper:** The badge is injected on every request at the edge. Even if someone caches the page and strips the badge, any visitor loading directly from the CDN always sees it. The badge injection is tied to the `plan_id` stored in the KV routing table — not to any flag the user can toggle.

**Upgrade hook:** When a free user upgrades, the KV routing entry is updated with the new plan_id. On the next request (within seconds due to KV propagation), the badge disappears. No republish needed.

---

## 3. Quota Enforcement Strategy

### 3.1 Quota Categories

| Category | Quota Key | Enforcement Point | Counting Method |
|---|---|---|---|
| **Project count** | `max_projects` | `POST /projects` | `COUNT(*) WHERE tenant_id = $1 AND status != 'archived'` |
| **Pages per project** | `max_pages_per_project` | `POST /projects/:id/pages` | `COUNT(*) WHERE project_id = $1` |
| **RSVP responses** | `max_rsvp` | Edge function (RSVP submit) | `COUNT(*) WHERE project_id = $1` per project |
| **Media storage** | `max_media_bytes` | `POST /media/upload` | `SUM(size_bytes) WHERE tenant_id = $1` |
| **Daily publishes** | `max_publish_per_day` | Publish pipeline validation | Redis INCR with daily TTL |
| **Template access** | `template_access` | `GET /templates/:id` | Plan entitlement check |

### 3.2 Quota Tracking Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      QUOTA ENFORCEMENT FLOW                                 │
│                                                                             │
│  Mutating Request                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                       │
│  │ Auth Middleware   │ → Extract tenant_id from JWT                         │
│  └────────┬────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                       │
│  │ Entitlement      │ → Load plan limits (Redis cache → DB fallback)       │
│  │ Middleware        │                                                      │
│  └────────┬────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐     ┌──────────────────────────────────────────────┐  │
│  │ Quota Middleware  │────▶│ quota_usage (materialized counters)          │  │
│  │                   │     │                                              │  │
│  │ 1. Read current   │     │ tenant_id | quota_key     | current | max   │  │
│  │    usage from     │     │ ──────────┼───────────────┼─────────┼─────  │  │
│  │    Redis counter   │     │ uuid-1    | projects      | 1       | 1    │  │
│  │                   │     │ uuid-1    | media_bytes   | 12.4M   | 50M  │  │
│  │ 2. Compare against│     │ uuid-1    | rsvp:proj-1   | 12      | 50   │  │
│  │    plan limit     │     │                                              │  │
│  │                   │     │ Redis mirrors this with                      │  │
│  │ 3. If at limit:   │     │ quota:{tenant_id}:{key} → atomic counters   │  │
│  │    403 + quota    │     └──────────────────────────────────────────────┘  │
│  │    _exceeded      │                                                      │
│  │                   │                                                      │
│  │ 4. If OK:         │                                                      │
│  │    proceed +      │                                                      │
│  │    INCR counter   │                                                      │
│  └───────────────────┘                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Dual-Write Consistency

Quota counters live in two places: Redis (for speed) and PostgreSQL `quota_usage` table (for durability). The consistency model:

**Write path:** On every quota-affecting mutation, the API atomically increments the Redis counter and enqueues a PostgreSQL update. The Redis counter is the authoritative real-time source. PostgreSQL is the durable reconciliation store.

**Reconciliation:** A cron job runs every 15 minutes, recomputing actual counts from source tables (`COUNT(*) FROM projects WHERE tenant_id = $1`) and overwriting both Redis and `quota_usage`. This self-heals any drift from failed writes, race conditions, or deleted resources.

**Read path:** Quota checks always read Redis first. If the Redis key is missing (e.g., after eviction), the middleware falls back to `quota_usage` table, rehydrates Redis, and continues.

**Edge case — race condition on project creation:** Two simultaneous `POST /projects` requests for a tenant at their 1-project limit. Redis INCR is atomic — the first request increments 0→1 (passes), the second increments 1→2 (fails, since limit is 1). The second request returns 403 and does NOT decrement (the reconciliation cron will correct the counter within 15 minutes, or the failed request handler decrements synchronously if the DB insert also failed).

### 3.4 Soft vs Hard Quotas

| Quota | Type | Over-Limit Behavior |
|---|---|---|
| `max_projects` | Hard | Block creation. 403 immediately. |
| `max_pages_per_project` | Hard | Block page creation. Existing pages remain. |
| `max_rsvp` | Soft | Accept response but mark as `over_quota`. Show owner a banner. Stop accepting at 2x limit (hard cap). |
| `max_media_bytes` | Hard | Block upload. Return bytes remaining. |
| `max_publish_per_day` | Soft | Allow with 60-second cooldown at limit. Hard block at 2x limit. |

**Why soft quota for RSVP?** A wedding guest submitting an RSVP should never see an error. Blocking a guest is a worse user experience than slightly exceeding a quota. The soft limit accepts the response, notifies the project owner, and uses the over-quota state as a high-intent upgrade trigger.

### 3.5 Downgrade Quota Handling

When a user downgrades from Pro to Free (or when a trial expires), they may exceed free tier limits. The system does NOT delete content. Instead:

```
Downgrade handling by quota type:

  projects (over limit):
    → All projects remain visible in dashboard
    → Most recently edited project stays "active"
    → Remaining projects marked "archived" (read-only)
    → Published sites stay live but gain branding badge
    → User can choose which project to keep active

  media (over limit):
    → No media deleted
    → Upload blocked until usage < new limit
    → Existing media continues to serve on published sites

  RSVP (over limit):
    → Historical responses remain viewable
    → New submissions accepted up to 2x free limit, then blocked
    → Export RSVP data always available (even on free plan)

  custom domain (lost entitlement):
    → Domain disconnected from CDN routing
    → DNS records become orphaned (user's responsibility)
    → Site reverts to {slug}.elove.me
    → Email notification sent with DNS cleanup instructions

  AI features (lost entitlement):
    → Previously AI-generated content remains in projects
    → AI generation endpoints return 403
    → No content removal
```

---

## 4. Billing Event Handling Flow

### 4.1 Stripe Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STRIPE INTEGRATION MAP                                    │
│                                                                             │
│  ELove Action              Stripe Object              Stripe API Call       │
│  ─────────────────────     ───────────────────────    ──────────────────    │
│  User signs up          →  Customer                →  customers.create     │
│  Start trial            →  (no Stripe object)      →  (internal only)     │
│  Choose Pro monthly     →  Checkout Session         →  checkout.sessions   │
│                            (mode: subscription)         .create            │
│  Choose Pro yearly      →  Checkout Session         →  checkout.sessions   │
│                            (mode: subscription)         .create            │
│  Choose Lifetime        →  Checkout Session         →  checkout.sessions   │
│                            (mode: payment)              .create            │
│  Manage billing         →  Customer Portal          →  billingPortal      │
│                                                         .sessions.create   │
│  Cancel subscription    →  (via Customer Portal)    →  (Stripe-hosted)    │
│  Change plan            →  Subscription update      →  subscriptions      │
│                                                         .update            │
│  Apply coupon           →  Promotion Code           →  (at checkout)      │
│  Referral credit        →  Customer Balance         →  customers          │
│                                                         .balanceTransac    │
│                                                         tions.create      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Webhook Processing Pipeline

```
POST /webhooks/stripe
  │
  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  1. SIGNATURE VERIFICATION                                               │
│     stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)            │
│     Reject if invalid → 400                                              │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  2. IDEMPOTENCY CHECK                                                    │
│     SELECT 1 FROM webhook_events WHERE stripe_event_id = $1              │
│     If exists → 200 OK (already processed)                               │
│     If new → INSERT into webhook_events with status = 'processing'       │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  3. EVENT ROUTING                                                        │
│                                                                          │
│  checkout.session.completed                                              │
│    ├─ mode = 'subscription' → handleNewSubscription()                    │
│    └─ mode = 'payment'      → handleLifetimePurchase()                   │
│                                                                          │
│  customer.subscription.updated                                           │
│    ├─ plan changed  → handlePlanChange()                                 │
│    ├─ status changed → handleStatusChange()                              │
│    └─ cancel_at set  → handleScheduledCancellation()                     │
│                                                                          │
│  customer.subscription.deleted                                           │
│    └─ → handleSubscriptionEnded()                                        │
│                                                                          │
│  invoice.payment_succeeded                                               │
│    └─ → handleRenewal()                                                  │
│                                                                          │
│  invoice.payment_failed                                                  │
│    └─ → handlePaymentFailure()                                           │
│                                                                          │
│  charge.refunded                                                         │
│    └─ → handleRefund()                                                   │
│                                                                          │
│  customer.subscription.trial_will_end                                    │
│    └─ → handleTrialEnding() (3 days before)                              │
│                                                                          │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  4. POST-PROCESSING                                                      │
│     • Invalidate Redis entitlement cache: DEL entitlements:{tenant_id}   │
│     • Invalidate KV routing plan_id (for watermark logic)                │
│     • Update webhook_events status = 'processed'                         │
│     • Emit internal event for notification service                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Critical Webhook Handlers

**handleNewSubscription():**
```
1. Extract customer_id, subscription_id, plan_id from session metadata
2. Lookup tenant by stripe_customer_id
3. UPDATE subscriptions SET
     plan_id = new_plan,
     stripe_subscription_id = sub_id,
     status = 'active',
     current_period_start = sub.current_period_start,
     current_period_end = sub.current_period_end,
     billing_type = 'recurring'
4. Recompute entitlement cache
5. Send welcome-to-pro email
6. Track conversion event: plan_upgraded { from: 'free', to: plan_id, source: session.metadata.source }
```

**handleLifetimePurchase():**
```
1. Extract customer_id, payment_intent_id from session
2. Lookup tenant by stripe_customer_id
3. UPDATE subscriptions SET
     plan_id = 'lifetime',
     stripe_payment_intent_id = pi_id,
     status = 'lifetime',
     billing_type = 'one_time',
     current_period_end = NULL
4. Recompute entitlement cache
5. Send lifetime-welcome email with "your sites will live forever" messaging
6. Track: lifetime_purchased { amount, source, referral_code }
```

**handlePaymentFailure():**
```
1. Lookup tenant by stripe_customer_id
2. Determine attempt count from invoice.attempt_count
3. If attempt 1:
     → UPDATE subscriptions SET status = 'past_due'
     → Send "payment failed, update card" email
     → In-app banner: "Payment failed. Update your card to keep Pro features."
     → No feature restriction yet
4. If attempt 2 (day ~3):
     → Send urgency email
     → Show blocking modal on editor load
5. If attempt 3 (day ~7):
     → Send final warning
6. After all retries exhausted (Stripe fires customer.subscription.deleted):
     → handleSubscriptionEnded() triggers grace period
```

**handlePlanChange() (upgrade/downgrade):**
```
Upgrade (free→pro, pro_monthly→pro_yearly):
  1. Update subscription record
  2. Invalidate caches
  3. If was free → remove branding badge (update KV)
  4. Unlock features immediately (entitlement cache refresh)
  5. Stripe handles proration automatically

Downgrade (pro→free):
  1. Stripe schedules downgrade at period end (cancel_at_period_end)
  2. Store cancel_at timestamp
  3. Features remain active until period end
  4. At period end, customer.subscription.deleted fires
  5. handleSubscriptionEnded() applies free plan limits
  6. Downgrade quota handling kicks in (Section 3.5)
```

### 4.4 Grace Period Design

When a subscription ends (cancellation, failed payments, or refund), the system grants a grace period before full downgrade:

```
Grace period timeline:

  Subscription ends (customer.subscription.deleted)
    │
    ├─ Day 0: status = 'canceled', grace_period_end = now() + 14 days
    │          Features: ALL Pro features remain active
    │          Badge: Still hidden
    │          Publish: Still allowed
    │          Notification: "Your Pro plan has ended. Resubscribe within 14 days to keep your features."
    │
    ├─ Day 7: Reminder email + in-app banner
    │          Features: Still active
    │
    ├─ Day 14: Grace period expires (cron job)
    │          → plan_id = 'free'
    │          → Apply downgrade quota handling (Section 3.5)
    │          → Badge appears on published sites
    │          → Custom domains disconnected
    │          → Notification: "Your Pro features have been deactivated."
    │
    └─ Day 14+: User can resubscribe at any time
               → Instant restoration of Pro features
               → Custom domain re-connection requires re-verification
```

**Why 14 days?** Wedding planning is time-sensitive. A couple whose card expired shouldn't lose custom domain access during their event. 14 days covers most card replacement cycles and creates goodwill without enabling significant abuse.

**Lifetime plan refund exception:** No grace period. Refund → immediate downgrade to free. The lifetime plan already represents extreme value ($199 vs ~$144/yr), so a refund indicates buyer's remorse, not a payment timing issue.

### 4.5 Webhook Reliability

```
webhook_events
├── id                UUID PK
├── stripe_event_id   TEXT UNIQUE NOT NULL    -- Stripe event ID for idempotency
├── event_type        TEXT NOT NULL
├── payload           JSONB NOT NULL
├── status            TEXT NOT NULL           -- 'processing' | 'processed' | 'failed'
├── error_message     TEXT
├── attempts          INTEGER DEFAULT 1
├── processed_at      TIMESTAMPTZ
├── created_at        TIMESTAMPTZ
```

**Failure handling:** If a webhook handler throws an error, the status is set to 'failed' and the endpoint returns 500. Stripe will retry up to 3 times over 3 hours. If still failing, a dead-letter alert fires to the ops channel. Manual retry via admin dashboard.

**Ordering guarantee:** Stripe does not guarantee webhook ordering. The system handles this by always fetching the current state from Stripe's API (`stripe.subscriptions.retrieve()`) inside the handler, rather than trusting the webhook payload alone. The webhook is a trigger, not a source of truth.

---

## 5. Abuse Prevention Strategy

### 5.1 Threat Model

| Threat | Vector | Impact | Severity |
|---|---|---|---|
| **Free tier farming** | Create multiple accounts to bypass project limit | Lost revenue, resource waste | Medium |
| **Trial abuse** | Repeated signups with disposable emails for perpetual Pro access | Lost revenue | Medium |
| **Publish spam** | Free accounts publishing SEO spam/phishing pages | Domain reputation, legal | High |
| **RSVP flooding** | Bots submitting thousands of RSVP responses | Database bloat, quota gaming | Medium |
| **Referral fraud** | Self-referrals or bot-generated referral chains | Financial loss | Medium |
| **Media abuse** | Uploading illegal content via media service | Legal, reputation | High |
| **Lifetime plan arbitrage** | Buy lifetime, use heavily, demand refund after event | Revenue loss | Low |

### 5.2 Mitigation Strategies

**Free tier farming:**
```
Detection:
  • Fingerprint on signup: IP + user agent + screen resolution + timezone hash
  • Store fingerprint in tenants.device_fingerprint
  • On new signup, check for existing tenants with same fingerprint
  • Disposable email detection via domain blocklist (updated weekly)

Response:
  • If fingerprint matches existing account:
    → Allow signup (don't block legitimate shared computers)
    → Flag for review
    → Rate-limit: max 3 free accounts per fingerprint per 30 days
    → 4th attempt → CAPTCHA gate
  • Disposable email:
    → Block signup with "Please use a permanent email address"
```

**Trial abuse:**
```
Detection:
  • Same fingerprint + new email = likely trial cycling
  • Track trial_count per fingerprint

Response:
  • First trial per fingerprint: normal
  • Second trial attempt (same fingerprint, different email):
    → Require credit card for trial
    → Card is not charged but validates identity
  • Third attempt:
    → No trial offered
    → Direct to pricing page
```

**Publish spam:**
```
Detection (three-stage, mirrors marketplace safety from template-engine doc):
  1. Pre-publish content scan:
     • URL extraction from all text content → check against Google Safe Browsing API
     • Keyword density analysis for SEO spam patterns
     • Image count-to-text ratio (spam sites are text-heavy with few images)
  2. Post-publish sampling:
     • Random 5% of free-tier publishes get manual review within 24h
     • Automated screenshot comparison against known spam layouts
  3. Reputation scoring:
     • Each tenant has a trust_score (0-100, starts at 50)
     • Successful publishes without flags → +1 per publish (max 100)
     • Flagged content → -20 per incident
     • trust_score < 20 → all publishes require manual approval
     • trust_score < 10 → account suspended pending review

Response:
  • Flagged content → unpublish immediately (remove R2 files, update KV routing to 410 Gone)
  • Notify tenant with specific violation
  • Two strikes → permanent ban
```

**RSVP flooding:**
```
Detection:
  • Rate limit on RSVP edge function: 10 submissions per IP per hour per project
  • Honeypot field in RSVP form (hidden input, if filled → bot)
  • Turnstile (Cloudflare) challenge on RSVP form for free-tier projects

Response:
  • Rate-limited requests → 429 with friendly "Please try again in a moment"
  • Bot-detected → silent discard (200 response but no DB write)
  • Flood detected (>100/hour on single project) → auto-enable Turnstile challenge
```

**Referral fraud:**
```
Detection:
  • Self-referral: referred_by cannot match own referral_code
  • Same IP/fingerprint referral chain detection
  • Referral only credited after referee completes qualifying action (defined below in Section 7)

Response:
  • Self-referral attempts → silently ignore referral_code, process signup normally
  • Suspicious chain → hold credits for 30-day review period
  • Confirmed fraud → revoke all credits, ban from referral program
```

### 5.3 Rate Limiting by Plan

| Endpoint Category | Free | Pro | Lifetime |
|---|---|---|---|
| API general (requests/min) | 60 | 300 | 300 |
| Media upload (requests/hour) | 20 | 100 | 200 |
| Publish (per day) | 3 | 20 | Unlimited |
| RSVP submit (per IP/hour/project) | 10 | 10 | 10 |
| AI generation (per day) | 0 | 30 | 50 |

Rate limits are enforced at the Cloudflare Worker edge using sliding window counters in KV (for per-IP limits) and Redis (for per-tenant limits).

---

## 6. Metrics to Track for Optimization

### 6.1 Revenue Metrics

| Metric | Definition | Source | Cadence |
|---|---|---|---|
| **MRR** | Sum of active recurring subscriptions normalized to monthly | `subscriptions` + Stripe | Daily |
| **ARR** | MRR × 12 | Derived | Daily |
| **Lifetime revenue** | Cumulative one-time lifetime payments | Stripe | Daily |
| **ARPU** | MRR / active paid accounts | Derived | Weekly |
| **LTV** | ARPU × average subscription duration | Derived | Monthly |
| **CAC** | Total acquisition spend / new paid customers | External + Stripe | Monthly |
| **LTV:CAC ratio** | Target >3:1 | Derived | Monthly |
| **Net revenue retention** | (MRR from existing customers at month end) / (MRR from same cohort at month start) | Stripe | Monthly |

### 6.2 Conversion Metrics

| Metric | Definition | Target | Alert Threshold |
|---|---|---|---|
| **Signup → Trial** | % of signups that start trial | >80% | <60% |
| **Trial → Paid** | % of trial users converting to any paid plan | >15% | <8% |
| **Free → Paid** | % of free users converting (all-time) | >5% | <2% |
| **Pro → Lifetime** | % of Pro users upgrading to lifetime | 10-20% | N/A |
| **Checkout abandonment** | % starting checkout but not completing | <40% | >60% |
| **Time to first publish** | Median time from signup to first publish | <30 min | >2 hours |
| **Time to upgrade** | Median time from signup to first paid conversion | <14 days | >30 days |

### 6.3 Quota-Driven Metrics (Upgrade Triggers)

| Metric | Purpose |
|---|---|
| **Quota hit rate by feature** | Which limits drive the most upgrade intent? |
| **Quota-to-upgrade conversion** | % of users who hit a quota and upgrade within 7 days |
| **Feature gate impression count** | How often upgrade prompts are shown per feature |
| **Feature gate CTR** | Click-through rate on upgrade prompts |
| **Post-upgrade feature adoption** | Do users actually use the feature they upgraded for? |

### 6.4 Health Metrics

| Metric | Definition | Target | Alert |
|---|---|---|---|
| **Churn rate** | Monthly: canceled / total active | <5% | >8% |
| **Involuntary churn** | Payment failures leading to cancellation | <1% | >2% |
| **Grace period recovery** | % of grace-period users who resubscribe | >30% | <15% |
| **Refund rate** | Refunds / total charges | <2% | >5% |
| **Dunning recovery** | % of failed payments recovered by retry | >60% | <40% |
| **Webhook processing lag** | p99 time from Stripe event to system update | <5s | >30s |

### 6.5 Instrumentation Strategy

All billing events are tracked to two destinations:

1. **PostgreSQL `billing_events` table** — for operational queries and debugging:
```
billing_events
├── id              UUID PK
├── tenant_id       UUID FK
├── event_type      TEXT NOT NULL     -- 'plan_upgraded' | 'quota_hit' | 'feature_gate_shown' | ...
├── metadata        JSONB             -- { from_plan, to_plan, feature_key, source, ... }
├── created_at      TIMESTAMPTZ
```

2. **Cloudflare Analytics Engine** — for aggregated dashboards (zero-cost, integrated with existing analytics from publishing engine doc):
   - Event: `billing.conversion` with dimensions: `source`, `plan`, `trigger_feature`
   - Event: `billing.quota_hit` with dimensions: `quota_key`, `plan`, `usage_percent`
   - Event: `billing.churn` with dimensions: `plan`, `tenure_days`, `reason`

---

## 7. Conversion Leverage Points

### 7.1 Conversion Architecture

The system is designed with specific trigger moments where upgrade prompts have the highest conversion probability:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONVERSION FUNNEL MAP                                     │
│                                                                             │
│  Signup (Free)                                                              │
│    │                                                                        │
│    ├──▶ Trigger 1: TEMPLATE SELECTION                                       │
│    │     Free user sees locked premium templates                            │
│    │     → "Unlock 50+ premium templates with Pro"                          │
│    │     Conversion rate: ~8% of users who browse templates                 │
│    │                                                                        │
│    ├──▶ Trigger 2: FIRST PUBLISH                                            │
│    │     Badge preview shown before publish confirmation                    │
│    │     → "Remove the ELove badge and use your own domain"                 │
│    │     Conversion rate: ~12% (highest intent moment)                      │
│    │                                                                        │
│    ├──▶ Trigger 3: QUOTA HIT                                                │
│    │     User hits project, page, or RSVP limit                             │
│    │     → Contextual upgrade with specific limit comparison                │
│    │     Conversion rate: ~15% (friction-driven, highest conversion)        │
│    │                                                                        │
│    ├──▶ Trigger 4: RSVP MILESTONE                                           │
│    │     25th RSVP received (50% of free limit)                             │
│    │     → "You're getting popular! Upgrade to handle 500+ guests"          │
│    │     Conversion rate: ~6% (social proof moment)                         │
│    │                                                                        │
│    ├──▶ Trigger 5: AI FEATURE ATTEMPT                                       │
│    │     User clicks AI text generation or image enhance                    │
│    │     → Demo preview of AI result + "Unlock AI with Pro"                 │
│    │     Conversion rate: ~10% (desire-driven)                              │
│    │                                                                        │
│    ├──▶ Trigger 6: SHARE MOMENT                                             │
│    │     User copies published URL to share                                 │
│    │     → "Impress your guests with a custom domain: yourwedding.com"      │
│    │     Conversion rate: ~5%                                               │
│    │                                                                        │
│    └──▶ Trigger 7: TRIAL EXPIRY                                             │
│          3 days before trial end + on expiry day                            │
│          → "Keep your Pro features — special offer: 30% off first month"    │
│          Conversion rate: ~20% (loss aversion)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Upgrade Prompt System

Each trigger maps to a specific prompt variant stored in the system:

```
upgrade_prompts
├── id              UUID PK
├── trigger_type    TEXT NOT NULL     -- 'template_gate' | 'publish_badge' | 'quota_hit' | ...
├── feature_key     TEXT              -- NULL for non-feature triggers
├── headline        TEXT NOT NULL
├── subtext         TEXT NOT NULL
├── cta_text        TEXT NOT NULL
├── plan_target     TEXT NOT NULL     -- 'pro' or 'lifetime'
├── discount_code   TEXT              -- optional Stripe coupon
├── is_active       BOOLEAN DEFAULT true
├── ab_variant      TEXT              -- 'A' | 'B' for testing
└── created_at      TIMESTAMPTZ
```

**A/B testing infrastructure:** Every upgrade prompt impression and click is tracked via `billing_events`. The system randomly assigns prompt variants (A/B) per user session and measures conversion rate per variant. A scheduled weekly job identifies statistically significant winners (p < 0.05, minimum 100 impressions per variant) and auto-promotes winners.

### 7.3 Pricing Psychology Levers

**Anchoring:** The lifetime plan ($199) is displayed between Pro monthly ($12/mo) and Pro yearly ($99/yr = $8.25/mo). The lifetime price anchors against the yearly cost: "Pay for 2 years, own it forever." At a typical wedding planning horizon of 12-18 months, lifetime appears rational.

**Loss aversion at publish:** The publish confirmation dialog for free users shows a split preview: left side shows the site with the badge, right side shows the site without. The "remove badge" CTA links directly to checkout with the monthly plan pre-selected (lowest commitment barrier).

**Urgency on trial:** Trial users see a countdown in the editor toolbar: "Pro trial: 3 days remaining." The countdown becomes red at <24 hours. This is genuine urgency (features will actually be lost), not artificial scarcity.

**Social proof in RSVP notifications:** When a free-tier user receives RSVP responses, the notification email includes: "12 guests have RSVP'd. Pro users manage up to 500 RSVPs and track dietary preferences." Real data, real value proposition.

### 7.4 Upgrade/Downgrade Flow — Complete State Machine

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    PLAN TRANSITION STATE MACHINE                          │
│                                                                          │
│  Current Plan      Action              Result                           │
│  ────────────      ──────              ──────                           │
│                                                                          │
│  free          →   upgrade to pro_mo   →  Stripe Checkout (subscription)│
│  free          →   upgrade to pro_yr   →  Stripe Checkout (subscription)│
│  free          →   upgrade to lifetime →  Stripe Checkout (payment)     │
│                                                                          │
│  trial         →   convert to pro_mo   →  Stripe Checkout (subscription)│
│  trial         →   convert to pro_yr   →  Stripe Checkout (subscription)│
│  trial         →   convert to lifetime →  Stripe Checkout (payment)     │
│  trial         →   trial expires       →  Downgrade to free             │
│                                                                          │
│  pro_monthly   →   switch to pro_yr    →  Stripe sub update (proration) │
│  pro_monthly   →   upgrade to lifetime →  Cancel sub + Checkout (pay)   │
│  pro_monthly   →   cancel              →  Active until period end       │
│                                          then grace period → free       │
│                                                                          │
│  pro_yearly    →   switch to pro_mo    →  NOT ALLOWED (downgrade at     │
│                                          renewal only)                  │
│  pro_yearly    →   upgrade to lifetime →  Cancel sub + Checkout (pay)   │
│                                          Prorated credit as coupon      │
│  pro_yearly    →   cancel              →  Active until period end       │
│                                          then grace period → free       │
│                                                                          │
│  lifetime      →   (no changes)        →  Permanent. No billing events. │
│  lifetime      →   refund              →  Immediate downgrade to free   │
│                                                                          │
│  grace_period  →   resubscribe         →  Instant restoration to Pro    │
│  grace_period  →   expires             →  Downgrade to free             │
│                                                                          │
│  canceled/free →   re-upgrade          →  Normal checkout flow          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Pro → Lifetime transition:** When a Pro subscriber upgrades to lifetime, the system: (1) calculates the unused portion of their current billing period, (2) creates a Stripe coupon for that amount, (3) applies the coupon to the lifetime checkout, (4) after successful lifetime payment, cancels the Pro subscription immediately (no grace period needed — they're now on a better plan).

### 7.5 Referral System Design (Future-Ready)

The schema is prepared for referrals but the full system launches in Phase 2. Design decisions locked now to avoid migration debt:

```
Referral mechanics:

  Every paid user gets a referral_code (generated on first payment):
    Format: {tenant_slug}-{4-char-random}  e.g., "sarah-mike-a3f2"
    Stored in: subscriptions.referral_code

  Referral link: elove.me/r/{referral_code}
    → Sets cookie: elove_ref={referral_code}, 30-day expiry
    → Redirects to signup page

  Qualifying action (referee must complete):
    → Publish at least one project (proves real usage, not just signup)

  Reward structure (double-sided):
    Referrer: $10 account credit (applied to next invoice via Stripe balance)
    Referee: 15% off first paid plan (Stripe promotion code, auto-generated)

  Credit limits:
    Max $100 credit per referrer per year (10 referrals)
    Credits expire after 12 months if unused
    Credits cannot exceed invoice amount (no negative invoices)

  Tracking:
    referral_events table:
    ├── id              UUID PK
    ├── referrer_tenant  UUID FK
    ├── referee_tenant   UUID FK
    ├── referral_code    TEXT
    ├── status           TEXT      -- 'clicked' | 'signed_up' | 'qualified' | 'credited' | 'fraudulent'
    ├── credit_amount    INTEGER   -- cents
    ├── credited_at      TIMESTAMPTZ
    └── created_at       TIMESTAMPTZ
```

**Viral loop via badge:** The free-plan badge links to `elove.me/?ref={tenant_slug}`. Every published free-tier site becomes a passive referral channel. When a visitor clicks the badge, they land on the marketing site with the ref parameter tracked. This creates a viral coefficient without any active referral effort.

### 7.6 Revenue Projections Model

Based on conversion rates from comparable wedding SaaS platforms and the trigger system above:

```
At 100,000 registered users (architecture doc baseline):

  Free:      85,000 users (85%)         → $0
  Trial:      5,000 users (5%)          → $0 (converting or expiring)
  Pro Mo:     4,000 users (4%)          → $48,000/mo
  Pro Yr:     3,500 users (3.5%)        → $28,875/mo (amortized)
  Lifetime:   2,500 users (2.5%)        → $0/mo (already collected $497,500)
                                        ─────────────
  Estimated MRR:                          $76,875
  Estimated ARR:                          $922,500
  Plus lifetime collected:                $497,500 (in first ~18 months)

  Infrastructure cost at 100k users:      $566/mo (from publishing engine doc)
  Gross margin:                           99.3%

  Break-even:
    At $566/mo infrastructure + ~$2,000/mo tooling (Stripe, email, monitoring):
    Need ~215 Pro monthly subscribers OR ~26 Pro yearly subscribers
    Break-even at ~3,000 total users (assuming 7% paid conversion)
```

---

## Cross-Reference Index

| This Document Section | References |
|---|---|
| Plan entitlements | architecture-saas-wedding-platform.md §2 (plans table, revised here) |
| Watermark injection | publishing-engine-design.md §3 (HTMLRewriter badge injection) |
| Quota enforcement | architecture-saas-wedding-platform.md §6 (quota architecture, extended here) |
| Build priority lanes | publishing-engine-design.md §1 (Redis Streams P0-P3 lanes) |
| Content safety scanning | template-engine-deep-dive.md §7 (three-stage marketplace safety) |
| Entitlement in editor | visual-editor-system-design.md §3 (block capabilities, FeatureGate pattern) |
| Publish pipeline validation | publishing-engine-design.md §1.1 (VALIDATING state checks subscription) |
| Trial downgrade handling | visual-editor-system-design.md §8 (version control, archived project behavior) |
