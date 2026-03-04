# ELove Platform — Deployment Session 2026-03-04

## Mục tiêu

Triển khai toàn bộ ELove Platform (SaaS wedding invitation) lên production:
- **Web app** (Next.js 15) → Vercel
- **Build Worker** (Fly.io) → Singapore region
- **CDN + RSVP Workers** (Cloudflare Workers)
- **Database** (Supabase PostgreSQL — đã có schema)
- **Storage** (Cloudflare R2 bucket `akala`, prefix `elove/`)
- **CI/CD** (GitHub Actions)

---

## Trạng thái trước phiên

Tất cả 20 tasks implementation đã hoàn thành với **88 tests passing**:
- Monorepo setup (Turbo + pnpm)
- Schema Drizzle ORM (20 tables)
- Auth (Supabase)
- Template engine, DOM renderer
- Cloudflare Workers (site-serve, rsvp-submit)
- PayOS billing
- Entitlement engine (in-memory Map, no Redis)
- Email service (Resend, 8 Vietnamese templates)
- CI/CD GitHub Actions
- E2E Playwright tests

---

## Việc đã làm trong phiên này

### 1. GitHub Repository
- Tạo repo: `jokerlin135/elove` (public)
- Push toàn bộ code lên
- **Kết quả:** ✅ `https://github.com/jokerlin135/elove`

### 2. Vercel Deployment (Next.js web app)
- Tạo Vercel project: `elove-xi` (team: `team_AKtO5fPAulEE7jMIAlyHyef2`)
- Project ID: `prj_e03fTv8Y3VhFVINifZpJdpN2XGqa`
- Set 13 environment variables
- Deploy thành công
- **Kết quả:** ✅ `https://elove-xi.vercel.app` (HTTP 200)

### 3. Cloudflare KV Namespaces
Tạo 3 KV namespaces:
| Binding | Namespace ID |
|---------|-------------|
| ROUTING_TABLE | `1a32b8e4824749608f73f52de8ecc193` |
| DNS_MAP | `a775d78ca325468a83fcba6ba13b80fb` |
| RSVP_KV | `00636d708edd4cec8b3d67b1765f0316` |

### 4. Cloudflare Workers
- Tạo scoped API token: `elove-workers-deploy` (`7z3suC4w68K8wBc9zFi_vKV6KqdJX3PIPiH_y0Ta`)
- Update `wrangler.toml` với real KV IDs
- Deploy 2 workers:
  - `elove-site-serve.rations-volutes5n.workers.dev` ✅
  - `elove-rsvp-submit.rations-volutes5n.workers.dev` ✅
- **Account ID:** `e7eb76be9606c762e0b3ec91ae619424`

### 5. Database Migrations
- Chạy `drizzle-kit push` → "No changes detected"
- Verify qua Supabase REST API: **20 tables** tồn tại
- Seed data:
  - 3 plans: free / pro / lifetime
  - 24 entitlements seeded
- **Kết quả:** ✅ Database đầy đủ, không cần migrate

### 6. GitHub Secrets
Set 5 secrets cho CI/CD:
| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | `vcp_2pX7ps2iq...` |
| `VERCEL_ORG_ID` | `team_AKtO5fPAulEE7jMIAlyHyef2` |
| `VERCEL_PROJECT_ID` | `prj_e03fTv8Y3VhFVINifZpJdpN2XGqa` |
| `CF_API_TOKEN` | `7z3suC4w68K8wBc9zFi_...` |
| `FLY_API_TOKEN` | `FlyV1 fm2_lJPE...` |

### 7. Fly.io Build Worker
- App name: `elove-build-worker`
- Region: Singapore (`sin`)
- Machine: shared-cpu-2x, 2GB RAM
- Config: `apps/worker/fly.toml`
- Managed Postgres: ❌ (dùng Supabase)
- **Kết quả:** Đang deploy qua GitHub UI

---

## Credentials & Infrastructure Summary

| Service | Detail |
|---------|--------|
| Supabase project | `urcwmghrpmjnbusraoxz` |
| Supabase URL | `https://urcwmghrpmjnbusraoxz.supabase.co` |
| Vercel URL | `https://elove-xi.vercel.app` |
| GitHub repo | `github.com/jokerlin135/elove` |
| CF Account | `e7eb76be9606c762e0b3ec91ae619424` |
| CF R2 bucket | `akala` (prefix: `elove/`) |
| Fly.io app | `elove-build-worker` (sin) |
| Resend API | `re_9nrX2Ser_...` |

---

## Còn thiếu / TODO

- [ ] **PayOS credentials** chưa có: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` — billing feature chưa hoạt động
- [ ] **Custom domain** cho Vercel (nếu cần)
- [ ] **Custom domain** cho Cloudflare Workers (route `*.elove.vn/*`)
- [ ] Verify Fly.io deploy thành công sau khi user hoàn tất form

---

## Kết quả tổng thể

| Component | Status |
|-----------|--------|
| Code (88 tests) | ✅ Done |
| GitHub repo | ✅ Live |
| Vercel (web) | ✅ Live |
| CF Workers | ✅ Live |
| Supabase DB | ✅ Ready |
| GitHub Secrets | ✅ 5/5 set |
| Fly.io worker | 🔄 Deploying |
| PayOS billing | ⚠️ Cần credentials |
