# ELove Platform — Brainstorm: Workflow & Execution Overview

## Goal

Xây dựng **ELove Platform** — nền tảng SaaS thiệp cưới online với visual editor, hệ thống publish tĩnh trên CDN, billing Stripe 3 gói (Free/Pro/Lifetime), từ thiết kế hiện tại (7 tài liệu kỹ thuật) đến sản phẩm Beta trong 90 ngày.

---

## Constraints

- **Chưa có code** — toàn bộ project hiện tại chỉ là 7 file thiết kế markdown, chưa có dòng code nào
- **Tech stack cố định:** Next.js 15 + Konva.js + tRPC + Neon PostgreSQL + Upstash Redis + Cloudflare R2/Workers + Stripe + Resend
- **Tài liệu gốc:** `unified-technical-blueprint.md` v2.0 là Single Source of Truth, supersedes 5 tài liệu cũ
- **Team size nhỏ:** Tối thiểu 2 developers (1 backend, 1 frontend) cho 90 ngày
- **Chi phí hạ tầng MVP:** ~$50-150/tháng (Phase 1: 0-10k users)

---

## Known Context

- **7 tài liệu thiết kế đã viết xong**, bao gồm architecture, template engine deep dive, visual editor system design, publishing engine, monetization engine, unified blueprint, và execution plan
- **Blueprint v2.0 đã resolve 7 contradictions** (C1-C7) giữa các tài liệu cũ — từ 4 plan tiers xuống 3, từ Fabric.js sang Konva.js only, document lưu R2 thay vì PostgreSQL JSONB
- **7 overengineering items đã loại bỏ** (O1-O7): CRDT collaboration, A/B variants, copy-on-write templates, Redis Streams priority lanes, Lighthouse marketplace pipeline
- **Architecture 5 layers rõ ràng:** L0(Infra) → L1(Template) → L2(Editor) → L3(Publishing) → L4(Subscription) → L5(Growth)
- **DB schema 17 bảng** đã thiết kế chi tiết trong `unified-technical-blueprint.md` §7.1
- **12-step publish pipeline** đã thiết kế với budget thời gian cho từng step

Nguồn: [unified-technical-blueprint.md](file:///Users/mini4/bydone/elove/unified-technical-blueprint.md), [execution-plan.md](file:///Users/mini4/bydone/elove/execution-plan.md)

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Chưa có code nào** — 90 ngày để build toàn bộ SaaS là rất tight | High | Ưu tiên MVP — ship stack/grid editor trước, free-layout (Konva) sau. Bỏ bớt features không critical cho beta. |
| **Konva free-layout renderer phức tạp** — drag/resize/rotate/snap guides | High | Defer free-layout sang post-MVP nếu cần. Stack/grid layout đủ cho 90% wedding templates. |
| **Stripe webhook edge cases** (partial refunds, disputes, currency) | Medium | Build comprehensive test suite với Stripe CLI mock events trước launch. |
| **Build Worker 12-step pipeline là đoạn phức tạp nhất** — render HTML từ JSON document model | High | Implement từng step một, test riêng. Nếu timeout thì chia thành 2 worker steps. |

---

## Options

### Option A: Full 90-Day Plan (As Designed)
- **How:**
  - Build đúng theo execution-plan.md: L0→L1→L2→L3→L4→L5 trong 90 ngày
  - 2 work streams song song: Backend (A→C→E) và Frontend (B→D→F)
- **Pros:** Đầy đủ tính năng, đúng architecture đã thiết kế
- **Cons:** Rất tight schedule; risk cao nếu 1-2 developer
- **Effort:** L

### Option B: Slimmed MVP (60 days) + Polish (30 days)
- **How:**
  - Days 1-60: Core only — L0 + L1 + L2 (stack-layout only, no Konva) + L3 (publish) + L4 (Stripe basic)
  - Days 61-90: Polish + L5 (email, analytics, admin, monitoring)
  - Defer: Konva free-layout, custom domains, advanced animations, marketplace
- **Pros:** Shippable product sớm hơn; ít risk hơn
- **Cons:** Missing free-layout editor (big differentiator)
- **Effort:** M

### Option C: Phased Milestones (3 phases × 30 days)
- **How:**
  - **Phase 1 (Days 1-30):** Foundation + Template Engine + Editor Shell → "Can create & edit wedding invitation"
  - **Phase 2 (Days 31-60):** Full Editor + Media + RSVP + Publishing → "Can publish live wedding site"
  - **Phase 3 (Days 61-90):** Billing + Gating + Growth → "Can monetize, ready for beta launch"
  - Each phase has clear milestone validation before proceeding
- **Pros:** Incremental value delivery; can demo after each phase; easier to adjust scope
- **Cons:** Phase 3 is still dense (billing + admin + monitoring + email in 30 days)
- **Effort:** M-L

---

## Recommendation

**Option C — Phased Milestones** là lựa chọn tốt nhất. Lý do:

1. Mỗi phase có deliverable demo được, giúp validate sớm
2. Execution plan hiện tại đã tổ chức theo hướng này (Days 1-30, 31-60, 61-90) — chỉ cần formalise milestone gates
3. Nếu phase 1 bị overrun, có thể cắt scope Phase 3 sớm thay vì fail toàn bộ

---

## Acceptance Criteria

- [ ] **Phase 1 done (Day 30):** User đăng ký, tạo project từ template, edit text/image trong stack-layout editor, autosave hoạt động, undo/redo hoạt động
- [ ] **Phase 2 done (Day 60):** User upload ảnh, điền RSVP form, publish ra live site trên `{slug}.elove.me`, site hiển thị đúng HTML/CSS
- [ ] **Phase 3 done (Day 90):** Stripe checkout hoạt động, free/pro/lifetime plans enforce đúng, branding badge xuất hiện trên free sites, 8 email gửi đúng, admin dashboard hoạt động
- [ ] Tất cả 3 system templates (Elegant, Minimal, Playful) render đúng trên cả editor và published site
- [ ] Autosave không mất data (R2 write verified)
- [ ] Build pipeline chạy < 60s cho project 5 trang

---

## 📋 WORKFLOW CHI TIẾT — Cần Làm Gì

### 🔷 PHASE 1: Foundation + Editor (Days 1-30)

#### Week 1-2: Infrastructure Bootstrap (L0)
| # | Task | Output |
|---|------|--------|
| 1 | Setup Next.js 15 project + monorepo structure | Repo, package.json, tsconfig |
| 2 | Deploy PostgreSQL schema (17 bảng) lên Neon | Database ready, seed plans + entitlements |
| 3 | Tạo R2 bucket `elove-storage` + KV namespaces | R2 writable, KV accessible |
| 4 | Build Auth module (tRPC): register, login, OAuth, JWT | User can register/login |
| 5 | Setup CI/CD: GitHub Actions → Fly.io + Cloudflare | Auto-deploy on push |

#### Week 3-4: Template Engine + Editor Shell (L1 + L2 start)
| # | Task | Output |
|---|------|--------|
| 6 | Define TypeScript types: ProjectDocument + Theme (Zod schema) | Shared types package |
| 7 | Build Component Registry (7 types: text, image, video, shape, button, icon, divider) | Registry module |
| 8 | Create 3 system templates (Elegant, Minimal, Playful) → upload to R2 | Template bundles in R2 |
| 9 | Build Theme system: resolution chain, CSS custom properties | `resolveTheme()` function |
| 10 | Build Project CRUD API: create, list, get, delete (with template instantiation) | tRPC endpoints |
| 11 | Build Editor Shell: toolbar, page tree, property panel, canvas area | React SPA layout |
| 12 | Implement 6 core commands + undo/redo (100-step snapshots) | Command system |
| 13 | Build DOM renderer for stack-layout sections | Stack sections render |
| 14 | Implement Autosave: 2s debounce → R2 PUT + edit_revision increment | Autosave working |

**✅ Phase 1 Milestone:** User can register → create project from template → edit text → see changes → autosave to R2

---

### 🔷 PHASE 2: Full Editor + Publishing (Days 31-60)

#### Week 5-6: Editor Depth (L2 complete)
| # | Task | Output |
|---|------|--------|
| 15 | Build Konva renderer for free-layout sections (drag/resize/rotate) | Free-layout editing |
| 16 | Implement remaining 6 commands (UPDATE_LAYOUT, ADD/REMOVE/REORDER_PAGE, UPDATE_ANIMATION, UPDATE_META) | Full command set |
| 17 | 3-level validation: command, background (Web Worker), publish-gate | Validation system |
| 18 | Media upload: presigned URL → R2, thumbnail generation, quota tracking | Image upload works |
| 19 | Grid-layout renderer + mobile preview | Grid sections + preview |

#### Week 7-8: Interactive Components + Publishing (L3)
| # | Task | Output |
|---|------|--------|
| 20 | Build RSVP edge function (CF Worker) + database integration | RSVP form works |
| 21 | Build Guestbook edge function + rate limiting | Guestbook works |
| 22 | Build Countdown, Gallery lightbox, Music player islands | Interactive components |
| 23 | Build Build Worker trên Fly.io: 12-step render pipeline | HTML/CSS/JS output |
| 24 | Build CDN serving Worker: resolve domain → fetch R2 → serve HTML | Sites live on CDN |
| 25 | Setup subdomain routing: KV ROUTING_TABLE + DNS | `{slug}.elove.me` works |
| 26 | Theme switching: live preview trong editor | Theme system complete |

**✅ Phase 2 Milestone:** User can upload photos → add RSVP → publish → live site at `{slug}.elove.me` → guests can RSVP

---

### 🔷 PHASE 3: Billing + Growth + Launch (Days 61-90)

#### Week 9-10: Subscription Engine (L4)
| # | Task | Output |
|---|------|--------|
| 27 | Stripe integration: createCheckout, createPortalSession | Checkout flow |
| 28 | Webhook handler: 8 event types + idempotent processing | Billing sync |
| 29 | Entitlement engine: Redis cache + DB fallback, 12 feature keys | Entitlement checks |
| 30 | Quota enforcement: hard quotas + soft RSVP quota | Quotas work |
| 31 | Feature gating: `<FeatureGate>` component + API middleware + edge watermark | 3-layer gating |
| 32 | Grace period + trial system | Subscription lifecycle |

#### Week 11-12: Growth + Launch (L5)
| # | Task | Output |
|---|------|--------|
| 33 | Transactional email: 8 templates via Resend | Emails send |
| 34 | Custom domain setup (Cloudflare for SaaS API) | Custom domains work |
| 35 | Conversion triggers (7 upgrade prompts) | Conversion UX |
| 36 | Analytics dashboard (CF Analytics Engine queries) | Project analytics |
| 37 | Admin dashboard (user mgmt, template review, system health) | Admin tools |
| 38 | Monitoring: Sentry + Axiom + Checkly | Observability |
| 39 | Final testing + bug fixes + 3 template polish | Quality pass |
| 40 | **🚀 BETA LAUNCH** | Live product |

**✅ Phase 3 Milestone:** Full billing, 3 plan tiers enforced, admin tools, monitoring → Beta Launch

---

## 📁 Tóm Tắt File Hiện Có

| File | Mô tả | Trạng thái |
|------|--------|------------|
| [architecture-saas-wedding-platform.md](file:///Users/mini4/bydone/elove/architecture-saas-wedding-platform.md) | System architecture v1 (DB schema, API, scaling) | ⚠️ Superseded bởi blueprint v2.0 |
| [unified-technical-blueprint.md](file:///Users/mini4/bydone/elove/unified-technical-blueprint.md) | **SOURCE OF TRUTH** — Consolidated v2.0, đã resolve contradictions | ✅ Authoritative |
| [execution-plan.md](file:///Users/mini4/bydone/elove/execution-plan.md) | 5-layer implementation plan chi tiết, 90-day timeline | ✅ Active plan |
| [template-engine-deep-dive.md](file:///Users/mini4/bydone/elove/template-engine-deep-dive.md) | Template engine design (superseded) | ⚠️ Reference only |
| [visual-editor-system-design.md](file:///Users/mini4/bydone/elove/visual-editor-system-design.md) | Editor design (superseded) | ⚠️ Reference only |
| [publishing-engine-design.md](file:///Users/mini4/bydone/elove/publishing-engine-design.md) | Publishing pipeline design (superseded) | ⚠️ Reference only |
| [monetization-engine-design.md](file:///Users/mini4/bydone/elove/monetization-engine-design.md) | Billing/monetization design (superseded) | ⚠️ Reference only |

> [!IMPORTANT]
> Chỉ tham khảo `unified-technical-blueprint.md` và `execution-plan.md` khi code. 5 tài liệu cũ đã bị supersede — chỉ dùng khi cần deep-dive vào chi tiết cụ thể mà blueprint không cover.
