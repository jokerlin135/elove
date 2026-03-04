# Auth + Dashboard + Editor — Design Document

**Date:** 2026-03-04
**Status:** Approved

---

## Goal
Build 3 UI layers còn thiếu để ELove Platform có thể dùng end-to-end:
1. Auth (login/signup với Supabase + Google OAuth)
2. Dashboard (quản lý dự án thiệp cưới)
3. Editor (drag-drop sections, full layout)

---

## Architecture

```
/                   → Landing page (đã có)
/login              → Auth page (Supabase Auth UI)
/signup             → Auth page (Supabase Auth UI)
/dashboard          → Protected — danh sách thiệp
/editor/[projectId] → Protected — editor thiệp
```

**Middleware** `middleware.ts`: Supabase session check, redirect `/login` nếu chưa đăng nhập. Áp dụng cho `/dashboard/**` và `/editor/**`.

---

## Section 1: Auth Pages

### Tech
- `@supabase/auth-ui-react` + `@supabase/ssr` (server-side session)
- Custom theme dark theo landing page (rose/pink)

### Flow
```
/signup
  → email + password form
  → "Đăng nhập với Google" button
  → success → Supabase tạo user
             → webhook/callback tạo users + tenants record trong DB
             → redirect /dashboard

/login
  → email + password form
  → "Đăng nhập với Google" button
  → success → redirect /dashboard
```

### Auth callback
`/auth/callback` route: xử lý OAuth code exchange, tạo DB record nếu user mới, set cookie session.

---

## Section 2: Dashboard `/dashboard`

### Layout
Dark sidebar (fixed) + main content area.

**Sidebar:**
- Logo ELove
- Nav: Thiệp của tôi, Cài đặt, Billing
- Bottom: Avatar + email + Sign out

**Main:**
- Header: "Thiệp của tôi" + button "+ Tạo thiệp mới"
- Project grid: 3 cols desktop, 2 tablet, 1 mobile
- Empty state khi chưa có thiệp

### Project Card
```
┌─────────────────┐
│   [Thumbnail]   │  ← gradient placeholder hoặc ảnh preview
│                 │
├─────────────────┤
│ Tên thiệp       │
│ 15/06/2026      │
│ [Draft] / [Live]│
├─────────────────┤
│ [Edit] [Share]  │
└─────────────────┘
```

### Create Modal
Click "+ Tạo thiệp mới":
1. Chọn template (grid 6 mẫu)
2. Nhập: Tên thiệp, slug (auto-suggest từ tên)
3. Submit → `trpc.projects.create` → redirect `/editor/[id]`

### Data
- `trpc.projects.list` — load danh sách
- `trpc.projects.archive` — xóa/archive
- Optimistic update với React Query

---

## Section 3: Editor `/editor/[projectId]`

### Layout
```
┌── Toolbar (full width) ──────────────────────────────┐
│ ← Dashboard | Tên thiệp | Undo Redo | Save | Publish │
├── Left (240px) ─┬── Canvas (flex-1) ──┬── Right (280px) ─┤
│ PAGES           │                     │ PROPERTIES        │
│  • Page 1   ×   │  [Section block]    │ (contextual)      │
│  • Page 2   ×   │  [Section block]    │                   │
│  + Add page     │  [+ Add section]    │                   │
│─────────────────│                     │                   │
│ COMPONENTS      │                     │                   │
│  📝 Text        │                     │                   │
│  🖼 Image       │                     │                   │
│  👫 Couple info │                     │                   │
│  📅 Event       │                     │                   │
│  🎵 Music       │                     │                   │
│  💌 RSVP form   │                     │                   │
└─────────────────┴─────────────────────┴───────────────────┘
```

### State (Zustand editor.store.ts)
```ts
{
  projectId: string
  document: ProjectDocument      // loaded from tRPC
  theme: Theme
  selectedSectionId: string | null
  selectedComponentId: string | null
  history: { past: [], future: [] }  // undo/redo
  isDirty: boolean
  isSaving: boolean
}
```

### Actions
- `loadProject(id)` → `trpc.projects.get` → hydrate store
- `selectSection(id)` / `selectComponent(id)` → update PropertyPanel
- `moveSection(id, direction)` → drag-drop reorder
- `addSection(type)` → insert new section
- `updateProperty(path, value)` → Immer patch
- `undo()` / `redo()` → history stack
- `save()` → autosave mỗi 3s + manual save → `trpc.projects.update`
- `publish()` → gọi `/api/publish` → trigger Fly.io build worker

### PropertyPanel (contextual)
- **Section selected**: background color, padding, animation type
- **Text component**: content, font family, font size, color, alignment
- **Image component**: src (upload), alt, object-fit, border-radius
- **RSVP**: form fields config, deadline

### Canvas
- Click section/component → select
- Drag handle để reorder sections (dnd-kit)
- Double-click text → inline edit
- Hover → show controls

---

## Implementation Order (Hướng A)

1. **Supabase client setup** — `@supabase/ssr`, createBrowserClient, createServerClient
2. **Middleware** — session check + redirect
3. **Auth pages** — `/login`, `/signup`, `/auth/callback`
4. **Dashboard** — layout, project list, create modal
5. **Editor** — connect store to tRPC, drag-drop sections, property panel
6. **Publish flow** — trigger build worker

---

## Files cần tạo

### Auth
- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/middleware.ts`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/web/app/auth/callback/route.ts`

### Dashboard
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/app/(app)/layout.tsx` (sidebar layout)
- `apps/web/src/components/dashboard/ProjectCard.tsx`
- `apps/web/src/components/dashboard/CreateProjectModal.tsx`
- `apps/web/src/components/dashboard/Sidebar.tsx`

### Editor
- `apps/web/src/store/editor.store.ts` (connect thật)
- `apps/web/src/components/editor/Toolbar.tsx` (update)
- `apps/web/src/components/editor/Canvas.tsx` (drag-drop)
- `apps/web/src/components/editor/PropertyPanel.tsx` (contextual)
- `apps/web/src/components/editor/PageTree.tsx` (update)
- `apps/web/src/components/editor/ComponentPalette.tsx` (new)

### tRPC thêm
- `apps/web/src/server/projects/projects.router.ts` — thêm `update`, `publish`

---

## Dependencies cần thêm
- `@supabase/ssr` — server-side auth
- `@supabase/auth-ui-react` — auth form UI
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-drop
- `@trpc/react-query` config — tRPC client setup cho browser
