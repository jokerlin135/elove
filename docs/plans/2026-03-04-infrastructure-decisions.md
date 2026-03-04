# ELove Platform — Infrastructure Decisions (Pre-Implementation)

**Date:** March 4, 2026
**Status:** Approved — ready to implement

---

## Confirmed Stack (Final)

| Thành phần | Lựa chọn | Notes |
|-----------|----------|-------|
| Database | **Supabase PostgreSQL** | Project: urcwmghrpmjnbusraoxz.supabase.co |
| Auth | **Supabase Auth** | Email/password + Google OAuth. Bỏ tự build JWT. |
| Cache/Queue | **Supabase only** (bỏ Redis) | Realtime + table polling cho build queue |
| Object Storage | **Cloudflare R2** bucket `akala` | Prefix: `elove/` cho mọi paths |
| CDN / Edge | **Cloudflare Workers** | site-serve, rsvp-submit, guestbook-submit |
| Build Worker | **Fly.io** | Node.js process, 2 machines fixed |
| App Hosting | **Vercel** | Next.js 15, auto-deploy từ GitHub |
| Payment | **PayOS** (by VPBank) | Thay Stripe. Hỗ trợ VN cá nhân. |
| Email | **Resend** | 8 email templates, tiếng Việt |
| Monitoring | **Sentry + Axiom + Checkly** | Như plan gốc |

---

## Credentials Available

```
# Cloudflare
CF_ACCOUNT_ID=e7eb76be9606c762e0b3ec91ae619424
CF_API_TOKEN=jImGO489xIWYnoN0buECmQwdKd0EermQHyrXPES9
CF_GLOBAL_API_KEY=1866af8488ae3894dae322c712ed107e3396b

# R2
R2_ACCESS_KEY_ID=2f7b4134435bc7694299362388432166
R2_SECRET_ACCESS_KEY=f9965f0776c85fbf9f7d9fc021717716ec3c2b07d18b8dda20d80e4e0f6dd705
R2_BUCKET=akala
R2_ENDPOINT=https://e7eb76be9606c762e0b3ec91ae619424.r2.cloudflarestorage.com
R2_PREFIX=elove

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://urcwmghrpmjnbusraoxz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...XL4
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...06M8
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.urcwmghrpmjnbusraoxz.supabase.co:5432/postgres
# PASSWORD: lấy tại Supabase Dashboard → Settings → Database
```

---

## Credentials Cần Lấy Thêm

| Credential | Nơi Lấy | Bắt Buộc Trước Task |
|-----------|---------|---------------------|
| `DATABASE_URL` password | Supabase Dashboard → Settings → Database | Task 2 |
| `PAYOS_CLIENT_ID` | payos.vn → đăng ký merchant | Task 16 |
| `PAYOS_API_KEY` | payos.vn → dashboard | Task 16 |
| `PAYOS_CHECKSUM_KEY` | payos.vn → dashboard | Task 16 |
| `RESEND_API_KEY` | resend.com → API Keys | Task 18 |
| `INTERNAL_KEY` | Tự sinh: `openssl rand -hex 32` | Task 13 |

---

## Redis → Supabase Migration Map

Plan gốc dùng Redis cho 5 use cases — tất cả đã được replace:

| Redis Use Case | Giải pháp Supabase |
|---|---|
| Build queue (`RPUSH build_jobs`) | Table `build_jobs` + Supabase Realtime hoặc polling 5s |
| Entitlement cache (5min TTL) | Next.js `unstable_cache()` + revalidateTag, hoặc in-memory Map |
| Editor tab lock (`SET lock:project:{id} EX 60`) | Table `editor_locks(project_id, tab_id, expires_at)` |
| RSVP quota counter | Đọc trực tiếp từ `quota_usage` table (đã có) |
| Webhook idempotency | Table `webhook_events` (đã có trong schema) |

---

## Supabase Auth Integration Pattern

```typescript
// Thay thế toàn bộ Task 6 (auth.service.ts)
// Client-side
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Register
await supabase.auth.signUp({ email, password });

// Login
await supabase.auth.signInWithPassword({ email, password });

// Get current user (server-side với service role)
const { data: { user } } = await supabase.auth.getUser(token);

// RLS policy (dùng auth.uid() thay current_setting)
// USING (user_id = auth.uid())
// USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
```

---

## PayOS Integration Pattern (Task 16)

```typescript
// Thay thế Stripe checkout
import PayOS from "@payos/node";
const payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

// Tạo payment link
const payment = await payos.createPaymentLink({
  orderCode: Date.now(),
  amount: 150000, // VND
  description: "ELove Pro 1 tháng",
  returnUrl: `${APP_URL}/dashboard?payment=success`,
  cancelUrl: `${APP_URL}/dashboard?payment=cancelled`,
});
// payment.checkoutUrl → redirect user

// Webhook verify
const isValid = payos.verifyPaymentWebhookData(webhookBody);
```

---

## Tasks Removed / Changed vs Original Plan

| Task | Thay Đổi |
|------|---------|
| Task 6: Auth module | **XÓA** — Supabase Auth thay thế |
| Task 2: DB Schema | Dùng `@supabase/supabase-js` + Drizzle trên Supabase |
| Task 7: Project CRUD | Dùng Supabase client |
| Task 10: Autosave | Build queue = Supabase table, không có Redis |
| Task 13: Build Worker | Polling `build_jobs` table thay BLPOP |
| Task 16: Billing | **PayOS** thay Stripe |
| Task 17: Entitlements | Next.js cache thay Redis |
| Tất cả R2 paths | Prefix `elove/` trước mọi key |

---

## Build Jobs Table (Thay Redis Queue)

```sql
CREATE TABLE build_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  tenant_id UUID NOT NULL,
  publish_version INTEGER NOT NULL,
  source_edit_revision INTEGER NOT NULL,
  document_r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | processing | done | failed
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Build Worker polls:
SELECT * FROM build_jobs
WHERE status = 'queued'
ORDER BY queued_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

## Editor Lock Table (Thay Redis SET EX)

```sql
CREATE TABLE editor_locks (
  project_id UUID PRIMARY KEY REFERENCES projects(id),
  tab_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
-- Lock: INSERT ... ON CONFLICT DO UPDATE SET tab_id, expires_at = NOW() + interval '60 seconds'
-- Check: WHERE project_id = $1 AND expires_at > NOW() AND tab_id != $myTabId
-- Refresh: UPDATE SET expires_at = NOW() + interval '60 seconds' every 45s
```
