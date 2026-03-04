# ELove Platform — Developer Execution Plan

**Version:** 1.1
**Date:** March 4, 2026
**Updated:** March 4, 2026 — Added Architecture Decisions section (15 decisions from design interview)
**Source of truth:** `unified-technical-blueprint.md` v2.0
**Constraint:** No code. No generic SaaS advice. Every item references a specific table, R2 path, API endpoint, or component from the blueprint.

---

## Execution Philosophy

Five layers. Remove one → not a SaaS. Each layer has a clear boundary, owns specific database tables, R2 paths, and API surface. Layers are built bottom-up: Layer 1 is the foundation everything depends on. Layer 5 cannot exist without Layers 1-4.

```
┌─────────────────────────────────────────────┐
│  LAYER 5: GROWTH ENGINE                     │  ← Marketplace, referrals, AI, analytics
│  Depends on: L1, L2, L3, L4                │
├─────────────────────────────────────────────┤
│  LAYER 4: SUBSCRIPTION ENGINE               │  ← Stripe, gating, quotas, grace period
│  Depends on: L1, L2, L3                    │
├─────────────────────────────────────────────┤
│  LAYER 3: PUBLISHING ENGINE                 │  ← Build worker, R2 deploy, CDN serve
│  Depends on: L1, L2                        │
├─────────────────────────────────────────────┤
│  LAYER 2: EDITOR ENGINE                     │  ← Visual editor, commands, autosave
│  Depends on: L1                            │
├─────────────────────────────────────────────┤
│  LAYER 1: TEMPLATE ENGINE                   │  ← Document model, components, themes
│  Depends on: Infrastructure (DB, R2, Auth) │
└─────────────────────────────────────────────┘
```

---

## Layer 0: Infrastructure Bootstrap (Days 1-7)

Not a "layer" in the product sense, but nothing works without it. Shared foundation.

### Module Ownership

| Module | Owner | Tables Owned | R2 Paths Owned |
|---|---|---|---|
| Database schema | Backend lead | ALL 17 tables (§7.1) | — |
| R2 bucket structure | Backend lead | — | ALL prefixes (§7.2) |
| Auth system | Backend lead | `tenants`, `users` | — |
| CI/CD pipeline | DevOps / Backend lead | — | — |

### Implementation Order (strict sequence)

**Step 0.1 — PostgreSQL schema deploy**
- Target: Neon PostgreSQL instance
- Execute the full DDL from blueprint §7.1: 17 tables, all indexes
- Seed `plans` table with 3 rows: `free`, `pro`, `lifetime`
- Seed `plan_entitlements` table with all feature_key/value pairs from blueprint §10.1:
  - `free`: `max_projects=1`, `max_pages=3`, `max_rsvp=50`, `max_media_bytes=52428800`, `custom_domain=false`, `remove_branding=false`, `ai_features=false`, `template_access=free`, `analytics_tier=basic`, `max_publishes_day=3`, `max_sections_page=8`, `rsvp_quota_type=soft`
  - `pro`: same keys with pro values
  - `lifetime`: same keys with lifetime values
- Validation: `SELECT count(*) FROM plan_entitlements` = 36 (12 keys × 3 plans)

**Step 0.2 — R2 bucket + KV namespace**
- Create R2 bucket: `elove-storage`
- Create KV namespaces: `ROUTING_TABLE`, `DNS_MAP`, `PLAN_CACHE`, `ENTITLEMENT_CACHE`
- Verify paths writable: `projects/`, `media/`, `templates/`, `published/`, `shared/`

**Step 0.3 — Auth module**
- tRPC router: `auth.register`, `auth.login`, `auth.loginOAuth`, `auth.me`, `auth.logout`
- On register: INSERT `tenants` row (auto-generate slug from couple names) → INSERT `users` row → INSERT `subscriptions` row with `plan_id='free'`, `status='active'`
- JWT payload: `{ userId, tenantId, planId, role }`
- Session storage: Upstash Redis, key `session:{token}`, TTL 7 days

**Step 0.4 — CI/CD**
- GitHub Actions: lint → test → deploy
- Deploy targets: Fly.io (Core API + Build Worker), Cloudflare (Workers + R2 + KV)
- Branch strategy: `main` → production, `dev` → staging (Neon branch)

### Exit Criteria
- [ ] All 17 tables exist with correct indexes
- [ ] R2 bucket accepts PUT/GET
- [ ] User can register, login, receive JWT
- [ ] `subscriptions` row created on signup with `plan_id='free'`
- [ ] CI/CD deploys to staging on push to `dev`

---

## Layer 1: Template Engine (Days 8-21)

The document model is the DNA of the platform. Every other layer reads from or writes to ProjectDocument and Theme. If the schema is wrong here, everything downstream breaks.

### What Layer 1 Owns

| Module | Tables | R2 Paths | API Surface |
|---|---|---|---|
| Document model | `projects` (metadata only) | `projects/{tenant_id}/{project_id}/document.json`, `projects/{tenant_id}/{project_id}/theme.json` | — |
| Component registry | — | — | Client-side module |
| Theme system | — | `templates/{id}/v{ver}/bundle.json` → default theme inside | `themes.list`, `themes.getTokens` |
| Template management | `templates`, `template_versions` | `templates/{id}/v{ver}/bundle.json`, `templates/{id}/v{ver}/assets/` | `templates.list`, `templates.get`, `templates.instantiate` |
| Project CRUD | `projects` | `projects/{tid}/{pid}/document.json` | `projects.create`, `projects.list`, `projects.get`, `projects.delete` |

### Module 1.1: ProjectDocument Schema (Days 8-10)

Define the TypeScript types that every system depends on.

**ProjectDocument** (stored at `r2://projects/{tenant_id}/{project_id}/document.json`):
```
{
  structure: {
    pages: [{
      id: string,
      slug: string,
      title: string,
      sections: [{
        id: string,
        type: string,           // from component registry
        layoutMode: 'stack' | 'grid' | 'free',
        slots: [{
          id: string,
          componentType: string, // text | image | video | shape | button | icon | divider
          props: Record<string, any>,
          position?: { x, y, w, h, rotation, zIndex }  // only for free layout
        }]
      }]
    }],
    globalSlots: {
      navigation: SlotConfig | null,
      musicPlayer: SlotConfig | null,
      footer: SlotConfig | null
    }
  },
  content: {
    data: {
      couple: { partner1, partner2, weddingDate, venue, story },
      event: { ceremonies: [], receptions: [], afterParties: [] },
      gallery: { albums: [] },
      rsvp: { formFields: [], deadline },
      music: { tracks: [], autoplay: boolean }
    },
    slotContent: { [slotId]: { type, value, bindings } },
    customSections: []
  },
  behavior: {
    sectionBehaviors: { [sectionId]: { entrance, scroll, parallax } },
    pageTransitions: { type, duration, easing },
    globalBehaviors: { smoothScroll, lazyLoad, prefetch },
    accessibilityFallback: { reducedMotion, highContrast, screenReader }
  }
}
```

**Theme** (stored at `r2://projects/{tenant_id}/{project_id}/theme.json`):
```
{
  baseThemeId: string,
  tokens: {
    color: { primary, secondary, accent, background, surface, text, textMuted },
    typography: { heading: { family, weight, sizes }, body: { family, weight, sizes } },
    spacing: { section, element, page },
    border: { radius, width, color },
    shadow: { sm, md, lg },
    animation: { duration, easing, stagger }
  },
  overrides: Partial<tokens>
}
```

**Validation:** Write a Zod schema that validates both structures. This schema is used by: the editor (client-side), the API (on autosave), and the build worker (pre-render validation). Single source of truth for document shape.

**Dependencies:** None. This is the root dependency.

### Module 1.2: Component Registry (Days 10-13)

A map of component types to their render functions, default props, and validation rules.

**MVP components (7 types):**

| Component | Props | Render Target | Default Size |
|---|---|---|---|
| `text` | `content: string, variant: heading\|body\|caption` | DOM (all layouts) | auto-height |
| `image` | `mediaId: string, alt: string, fit: cover\|contain` | DOM (all layouts) | 16:9 ratio |
| `video` | `url: string, autoplay: boolean, loop: boolean` | DOM (stack/grid only) | 16:9 ratio |
| `shape` | `shape: rect\|circle\|line, fill: string, stroke: string` | Konva (free only), DOM (stack/grid) | 100×100 |
| `button` | `label: string, action: url\|scroll\|rsvp` | DOM (all layouts) | auto |
| `icon` | `name: string, size: number, color: string` | SVG in DOM | 24×24 |
| `divider` | `style: solid\|dashed\|dotted\|ornamental, thickness: number` | DOM (all layouts) | full-width |

**Registry structure:**
```
ComponentRegistry = Map<string, {
  type: string,
  displayName: string,
  category: 'content' | 'media' | 'decoration' | 'interactive',
  defaultProps: Record<string, any>,
  propsSchema: ZodSchema,
  renderDOM: (props, themeTokens) => ReactElement,
  renderKonva: (props, themeTokens) => KonvaNode | null,  // null if not supported
  renderStatic: (props, themeTokens) => string,            // HTML string for publish
}>
```

Each component has THREE render targets: DOM (editor stack/grid), Konva (editor free layout), Static HTML (publish pipeline step 5). The static renderer is used by the Build Worker.

**Dependencies:** Module 1.1 (props reference the document schema).

### Module 1.3: Theme System (Days 13-16)

**Theme resolution chain:**
1. Load `baseThemeId` → fetch base theme tokens from `templates/{id}/v{ver}/bundle.json`
2. Deep-merge `overrides` on top of base tokens
3. Output: flat CSS custom properties object

```
resolveTheme(theme: Theme): Record<string, string>
// Example output:
// { '--color-primary': '#8B5E3C', '--font-heading-family': 'Playfair Display', ... }
```

**Where theme tokens are consumed:**
- Editor: injected as CSS variables on the editor canvas container div
- Publish pipeline Step 4 (Compile Theme): converted to CSS `@font-face` declarations + `:root` custom properties + responsive overrides

**System themes for MVP (3):**
1. **Elegant** — serif headings (Playfair Display), muted gold/ivory palette, generous spacing
2. **Minimal** — sans-serif (Inter), black/white with one accent, tight spacing
3. **Playful** — rounded display font (Quicksand), pastel palette, animated transitions

Each theme is a `bundle.json` in R2 at `templates/{template_id}/v1/bundle.json` containing the full document structure + default theme tokens + placeholder content.

**API endpoints:**
- `templates.list` → returns template metadata from `templates` table (filtered by `status='published'`)
- `templates.get({ templateId, version })` → returns template bundle from R2

**Dependencies:** Module 1.1 (theme schema), Module 1.2 (components reference theme tokens).

### Module 1.4: Template Instantiation + Project CRUD (Days 16-21)

**`projects.create({ templateId, title, slug })`:**
1. Validate `templateId` exists in `templates` table, `status='published'`
2. Fetch `templates/{templateId}/v{currentVersion}/bundle.json` from R2
3. Deep-copy the template's structure/content/behavior into a new ProjectDocument
4. Store placeholder content (template defaults) — user hasn't edited yet
5. PUT `projects/{tenant_id}/{project_id}/document.json` to R2
6. PUT `projects/{tenant_id}/{project_id}/theme.json` to R2 (template's default theme)
7. INSERT into `projects` table: `r2_document_key`, `template_id`, `template_version`, `edit_revision=0`, `publish_version=0`, `status='draft'`
8. Return `{ projectId, slug, r2DocumentKey }`

**Quota check on create:** Read `quota_usage` WHERE `tenant_id` AND `quota_key='projects'`. Compare against entitlement `max_projects`. If exceeded → 403 with `upgrade_required`. (This is a Layer 4 concern but the check hook must be designed here.)

**`projects.get({ projectId })`:**
1. Fetch metadata from `projects` table
2. Fetch document from R2 at `r2_document_key`
3. Fetch theme from R2 at `projects/{tenant_id}/{project_id}/theme.json`
4. Return merged response

**`projects.list({ tenantId })`:** Query `projects` table WHERE `tenant_id`, ordered by `updated_at DESC`.

**`projects.delete({ projectId })`:** Soft archive — SET `status='archived'`, keep R2 files for 30 days.

**Dependencies:** Module 1.1 (document schema), Module 1.3 (theme in template bundle), Layer 0 (auth, database, R2).

### Layer 1 Exit Criteria
- [ ] ProjectDocument and Theme TypeScript types exported as shared package
- [ ] Zod validation schema passes for all 3 system templates
- [ ] Component registry has 7 components with DOM + static renderers defined
- [ ] 3 template bundles uploaded to R2 at correct paths
- [ ] `projects.create` copies template → R2, inserts metadata → PostgreSQL
- [ ] `projects.get` returns document from R2 + metadata from PostgreSQL
- [ ] Theme resolution produces correct CSS custom properties for all 3 themes

---

## Layer 2: Editor Engine (Days 22-45)

The editor is the product. Users spend 90% of their time here. Layer 2 reads/writes the ProjectDocument from Layer 1 and must never break the document schema.

### What Layer 2 Owns

| Module | Tables | R2 Paths | API Surface |
|---|---|---|---|
| Editor shell (React SPA) | — | — | Client-side |
| Command system | — | — | Client-side |
| DOM renderer | — | — | Client-side |
| Konva renderer | — | — | Client-side |
| Autosave | `projects.edit_revision` | `projects/{tid}/{pid}/document.json` (overwrite) | `projects.autosave` |
| Media upload | `media` | `media/{tid}/{mid}/original.{ext}`, `media/{tid}/{mid}/thumb.webp` | `media.getUploadUrl`, `media.confirmUpload` |
| Validation | — | — | Client-side + API middleware |

### Module 2.1: Editor Shell (Days 22-26)

**Layout (4 panels):**
```
┌──────────┬───────────────────────────┬──────────────┐
│  Page    │                           │  Property    │
│  Tree    │     Canvas Area           │  Panel       │
│          │     (DOM or Konva)        │              │
│  Section │                           │  Props for   │
│  Nav     │                           │  selected    │
│          │                           │  element     │
├──────────┴───────────────────────────┴──────────────┤
│  Toolbar: Add Section | Theme | Preview | Publish    │
└─────────────────────────────────────────────────────┘
```

**State management (single store):**
```
EditorState {
  document: ProjectDocument      // from Layer 1 schema
  theme: Theme                   // from Layer 1 schema
  selection: {
    pageId: string | null,
    sectionId: string | null,
    slotId: string | null
  }
  undoStack: DocumentSnapshot[]  // max 100, structural sharing via immer
  redoStack: DocumentSnapshot[]
  dirty: boolean                 // true if unsaved changes
  lastSavedHash: string          // SHA-256 of last saved document JSON
  editRevision: number           // mirrors projects.edit_revision
  serverEditRevision: number     // last known server value
}
```

**On editor mount:**
1. Call `projects.get({ projectId })` → receive document + theme
2. Initialize EditorState with document, theme, empty undo/redo stacks
3. Compute `lastSavedHash = sha256(JSON.stringify(document))`
4. Render page tree from `document.structure.pages`
5. Render first page's sections in canvas area

**Dependencies:** Layer 1 (ProjectDocument schema, theme resolution, project API).

### Module 2.2: Command System (Days 26-30)

**12 MVP commands from blueprint §9.2:**

Each command is a pure function: `(state: EditorState, payload) → EditorState`

| # | Command | Mutates | Example Payload |
|---|---|---|---|
| 1 | `UPDATE_CONTENT` | `document.content` | `{ path: 'data.couple.partner1.name', value: 'Minh' }` |
| 2 | `UPDATE_THEME_TOKEN` | `theme.overrides` | `{ tokenPath: 'color.primary', value: '#8B5E3C' }` |
| 3 | `SWITCH_THEME` | `theme.baseThemeId`, `theme.tokens` | `{ themeId: 'elegant' }` |
| 4 | `ADD_SECTION` | `document.structure.pages[].sections` | `{ pageId, afterSectionId, sectionType: 'hero' }` |
| 5 | `REMOVE_SECTION` | `document.structure.pages[].sections` | `{ pageId, sectionId }` |
| 6 | `REORDER_SECTION` | `document.structure.pages[].sections` | `{ pageId, sectionId, targetIndex: 2 }` |
| 7 | `ADD_PAGE` | `document.structure.pages` | `{ slug: 'our-story', title: 'Our Story' }` |
| 8 | `REMOVE_PAGE` | `document.structure.pages` | `{ pageId }` |
| 9 | `REORDER_PAGE` | `document.structure.pages` | `{ pageId, targetIndex: 1 }` |
| 10 | `UPDATE_LAYOUT` | `document.structure.pages[].sections[]` | `{ sectionId, patch: { layoutMode: 'free' } }` |
| 11 | `UPDATE_ANIMATION` | `document.behavior.sectionBehaviors` | `{ sectionId, config: { entrance: 'fadeIn' } }` |
| 12 | `UPDATE_META` | `projects.seo_meta` or `projects.settings` | `{ field: 'seo.title', value: 'Minh & Lan Wedding' }` |

**Command execution flow:**
1. Validate payload against command's Zod schema (from Layer 1 validation)
2. Push current document to `undoStack` (immer snapshot)
3. Apply mutation → produce new `document` (immer produce)
4. Clear `redoStack`
5. Set `dirty = true`
6. Trigger re-render of affected canvas section

**Undo/redo:** Pop from undoStack → push current to redoStack → set document to popped snapshot. No command replay — pure snapshot restoration. 100-step limit, oldest dropped.

**Dependencies:** Module 2.1 (EditorState), Layer 1 (document schema + Zod validation).

### Module 2.3: DOM Renderer — Stack & Grid Layouts (Days 30-35)

Renders sections where `layoutMode = 'stack'` or `'grid'` as standard React components.

**Rendering chain:**
1. For each section in current page: check `layoutMode`
2. If `stack`: render slots vertically in document order, CSS `display: flex; flex-direction: column`
3. If `grid`: render slots in CSS Grid with `grid-template-columns` from section config
4. Each slot → look up `componentType` in ComponentRegistry → call `renderDOM(props, themeTokens)`
5. Wrap each slot in a selection wrapper that handles click → set `selection.slotId`

**Interactive editing within DOM renderer:**
- Text components: `contentEditable` div with controlled state. On blur → dispatch `UPDATE_CONTENT` with path to that slot's text value
- Image components: click → open media picker (Module 2.6) → on select → dispatch `UPDATE_CONTENT` with new `mediaId`
- Drag reorder: sections and slots support drag-and-drop via pointer events → dispatch `REORDER_SECTION`

**Dependencies:** Module 2.2 (commands), Layer 1 Module 1.2 (component registry `renderDOM`).

### Module 2.4: Konva Renderer — Free Layout (Days 35-39)

Renders sections where `layoutMode = 'free'` using `react-konva`.

**Key differences from DOM renderer:**
- Slots have absolute `position: { x, y, w, h, rotation, zIndex }` in their props
- Konva Stage + Layer structure per section
- Each slot → ComponentRegistry `renderKonva(props, themeTokens)` → returns Konva nodes
- Selection: Konva Transformer with 8 handles (resize) + rotation anchor
- Drag: Konva's built-in draggable → on `dragend` → dispatch `UPDATE_CONTENT` with new `position`
- Snap guides: calculate alignment to other slots' edges/centers, show dashed lines at ±5px

**Coordinate system:** Konva stage size = section's configured width × height. All positions are relative to section origin (0,0 = top-left of section). Section width defaults to 1200px (desktop), scales down responsively.

**Dependencies:** Module 2.2 (commands), Layer 1 Module 1.2 (component registry `renderKonva`).

### Module 2.5: Autosave Pipeline (Days 32-34)

Runs in parallel with renderer work. Can be built concurrently with Modules 2.3/2.4.

**Flow (from blueprint §9.3):**
1. Any command sets `dirty = true`
2. Debounce timer: 2s default, 5s if user is actively typing, 30s forced max
3. On trigger: compute `currentHash = sha256(JSON.stringify(document))`
4. If `currentHash === lastSavedHash` → skip (no real change)
5. If `currentHash !== lastSavedHash`:
   - `PUT r2://projects/{tenant_id}/{project_id}/document.json` (full document JSON)
   - `PUT r2://projects/{tenant_id}/{project_id}/theme.json` (full theme JSON)
   - `PATCH /api/projects/{projectId}` body: `{ edit_revision: editRevision + 1 }`
   - On success: update `lastSavedHash`, increment `editRevision`
6. Conflict detection: if server responds with `edit_revision` > expected → another tab/session modified → show conflict dialog per blueprint §9.4

**Two-tab protection:**
- On editor mount: `BroadcastChannel('elove-editor-{projectId}')` → send `{ type: 'LOCK', tabId }`
- If another tab responds → show "This project is open in another tab" warning
- Server-side: `SET lock:project:{projectId} {tabId} EX 60` in Redis. Refresh every 45s. Autosave checks lock ownership before writing.

**Dependencies:** Layer 0 (R2, Redis), Layer 1 (document schema).

### Module 2.6: Media Upload (Days 39-42)

**Upload flow:**
1. User clicks image slot or drags file to canvas
2. Client calls `media.getUploadUrl({ filename, mimeType, sizeBytes })`
3. API validates: mime type in allowlist (image/jpeg, image/png, image/webp, image/gif, video/mp4), size under plan limit
4. API generates presigned R2 PUT URL for `media/{tenant_id}/{media_id}/original.{ext}`
5. Client uploads directly to R2 via presigned URL (no server bandwidth)
6. Client calls `media.confirmUpload({ mediaId })`
7. Server: read original from R2, generate 200px thumbnail → PUT `media/{tid}/{mid}/thumb.webp`
8. Server: extract dimensions, compute blurhash → INSERT into `media` table
9. Server: increment `quota_usage` WHERE `quota_key='media_bytes'` by `size_bytes`
10. Return `{ mediaId, thumbUrl, dimensions, blurhash }`

**In the editor:** Image components resolve `mediaId` to thumbnail URL for preview. Full-resolution originals are only loaded on zoom or when publish pipeline runs.

**Dependencies:** Layer 0 (R2, database), Layer 1 (media table schema).

### Module 2.7: Validation (Days 42-45)

Three-level validation from blueprint §9.2:

**Level 1 — Command validation (synchronous, every command):**
- Zod schema check on command payload
- Structural integrity: section count ≤ page limit, page count ≤ project limit
- Component-specific: text length limits, image dimension requirements
- Runs in command execution flow (Module 2.2 step 1)

**Level 2 — Background validation (async, after autosave):**
- Full document Zod validation against Layer 1 schema
- Cross-reference integrity: all `mediaId` refs exist in `media` table, all `sectionType` refs exist in component registry
- Dead slot detection: slots referencing deleted components
- Runs as Web Worker post-autosave

**Level 3 — Publish gate (server-side, on publish request):**
- Entitlement check: section count vs plan limit, page count vs plan limit
- Required content check: wedding date set, at least one page with content
- Media validation: all referenced media exists in R2
- This is the bridge to Layer 3

**Dependencies:** Layer 1 (Zod schemas, component registry), Module 2.2 (command flow), Module 2.5 (autosave trigger).

### Layer 2 Exit Criteria
- [ ] Editor loads ProjectDocument from R2 and renders all 3 system templates
- [ ] All 12 commands execute with undo/redo (100-step)
- [ ] Stack and grid sections render in DOM with interactive text editing
- [ ] Free-layout sections render in Konva with drag/resize/rotate
- [ ] Autosave writes to R2 within 2s of last edit, increments `edit_revision`
- [ ] Two-tab protection blocks concurrent editing
- [ ] Media upload via presigned URL, thumbnail generated, displayed in editor
- [ ] Validation catches invalid documents before they reach publish

---

## Layer 3: Publishing Engine (Days 46-65)

Layer 3 transforms the draft document (R2 JSON) into a live static site (R2 HTML/CSS/JS). It owns the Build Worker, the publish state machine, CDN serving, and domain routing.

### What Layer 3 Owns

| Module | Tables | R2 Paths | API/Workers |
|---|---|---|---|
| Publish pipeline | `published_versions` | `published/{project_id}/v{version}/*` | `projects.publish` |
| Build Worker | — | reads `projects/` + `media/`, writes `published/` | Fly.io process |
| Build queue | — | — | Redis list `build_jobs` |
| CDN serving | — | reads `published/` | CF Worker: `site-serve` |
| Domain routing | `custom_domains` | — | CF KV: `ROUTING_TABLE`, `DNS_MAP` |
| RSVP edge function | `rsvp_responses`, `quota_usage` | — | CF Worker: `rsvp-submit` |
| Guestbook edge function | `guestbook_entries` | — | CF Worker: `guestbook-submit` |
| Analytics | — | — | CF Analytics Engine |

### Module 3.1: Publish Request + State Machine (Days 46-48)

**`projects.publish({ projectId })`:**
1. Auth check: user owns project
2. **Entitlement check (Layer 4 hook):** daily publish count vs `max_publishes_day`, section count vs `max_sections_page`
3. Run Level 3 validation (from Layer 2 Module 2.7)
4. If validation passes: create `published_versions` row with `status='building'`, `publish_version = current + 1`, `source_edit_revision = current edit_revision`
5. RPUSH to Redis `build_jobs` queue:
   ```
   { build_id, project_id, tenant_id, publish_version,
     source_edit_revision, document_r2_key, queued_at }
   ```
6. Return `{ publishVersion, status: 'queued' }`

**State transitions:** IDLE → VALIDATING → SNAPSHOT → QUEUED → BUILDING → DEPLOYING → LIVE, with FAILED branching from any active state.

**Polling endpoint:** `projects.publishStatus({ projectId })` → returns current state + progress percentage (mapped from build step 1-12).

**Dependencies:** Layer 2 Module 2.7 (publish gate validation), Layer 1 (document schema), Layer 0 (Redis, database).

### Module 3.2: Build Worker — 12-Step Render Pipeline (Days 48-56)

**Deployment:** Node.js process on Fly.io, 2-vCPU machine. Runs `BLPOP build_jobs` in a loop.

**On job received:**
1. SET `build:{build_id}:heartbeat` in Redis (15s TTL, refresh every 10s)
2. UPDATE `published_versions` SET `status='building'`
3. Execute 12 steps:

**RESOLVE phase (Steps 1-4, ~3s):**

Step 1 — Snapshot + Merge:
- GET `r2://projects/{tid}/{pid}/document.json`
- GET `r2://projects/{tid}/{pid}/theme.json`
- Freeze: deep clone into build-local memory. No further R2 reads for document.
- Merge layers: resolve `theme.overrides` over `theme.tokens` into flat token set.

Step 2 — Bind Content:
- Walk `document.content.data` and resolve all `{{binding}}` placeholders in slot content
- Format dates per locale (Vietnamese default: `dd/MM/yyyy`)
- Apply fallback values for empty fields: "[Tên cô dâu]", "[Ngày cưới]", etc.

Step 3 — Resolve Assets:
- For each `mediaId` in document: query `media` table for `r2_key`, `dimensions`, `blurhash`
- Map to CDN URLs: `https://{cdn}/media/{tid}/{mid}/original.{ext}`
- Generate `srcset` entries: if responsive variants don't exist yet, invoke Sharp to generate 640w, 1024w, 1440w from original in R2
- Upload generated variants to `media/{tid}/{mid}/` in R2

Step 4 — Compile Theme:
- Tokens → CSS custom properties: `--color-primary: #8B5E3C;`
- Generate `@font-face` declarations for Google Fonts used in theme
- Generate responsive overrides: `@media (max-width: 768px) { :root { --spacing-section: 2rem; } }`

**COMPILE phase (Steps 5-8, ~4s):**

Step 5 — Layout + Render:
- For each page, for each section:
  - If `layoutMode='stack'`: generate flexbox CSS + HTML
  - If `layoutMode='grid'`: generate CSS Grid + HTML
  - If `layoutMode='free'`: generate absolute-positioned CSS + HTML (from Konva coordinates)
- For each slot: call `ComponentRegistry[type].renderStatic(props, resolvedTokens)` → HTML string
- Assemble section HTML fragments

Step 6 — Animation Compile:
- Read `document.behavior.sectionBehaviors`
- Generate CSS `@keyframes` for each animation type (fadeIn, slideUp, scaleIn, etc.)
- Generate `data-animate` attributes on section divs for island JS to trigger
- Generate `@media (prefers-reduced-motion: reduce)` variants that disable all animation

Step 7 — Responsive Compile:
- Generate mobile overrides: hide non-essential sections, stack grid sections vertically
- Breakpoints: 1200px (desktop), 768px (tablet), 480px (mobile)
- Each breakpoint gets its own `@media` block

Step 8 — Islands Extract:
- Scan document for interactive components: countdown, RSVP form, guestbook, gallery lightbox, music player, scroll-animate triggers
- For each: generate `<script type="module" src="/islands/{island}.{hash}.js"></script>` tag
- Total island JS budget: ~25KB (all islands combined)

**PACKAGE phase (Steps 9-12, ~5s):**

Step 9 — CSS Extract + Critical Split:
- Concatenate all CSS from Steps 4-7
- Deduplicate rules
- Split: above-fold CSS (hero section + first screen) → inline in `<head>`
- Deferred CSS → external `style.{hash}.css` file

Step 10 — JS Bundle:
- Bundle island scripts with shared utilities (IntersectionObserver polyfill, event delegation)
- Tree-shake: only include islands that exist in the document
- External: GSAP loaded from `shared/vendor/gsap.3.12.min.js` (not bundled)

Step 11 — HTML Assemble:
- Per page: build full HTML document
- `<head>`: charset, viewport, title, meta OG tags, critical CSS inline, font preloads, deferred CSS link
- `<body>`: section HTML in order, script tags for islands at bottom
- Inject Cloudflare Analytics Engine tracking snippet (zero-JS: `<img src="/__analytics">` beacon)

Step 12 — Asset Hash + Upload:
- Content-hash all output files (SHA-256 truncated to 8 chars)
- Parallel upload to R2 at `published/{project_id}/v{version}/`:
  - `index.html`, `{page-slug}.html`, `style.{hash}.css`, `shared.{hash}.js`, `islands/{name}.{hash}.js`, `assets/*`
- Update KV `ROUTING_TABLE`: key `{slug}.elove.me` → value `published/{project_id}/v{version}/`
- UPDATE `published_versions` SET `status='live'`, `build_hash`, `build_duration_ms`
- UPDATE `projects` SET `status='published'`, `published_at=now()`, `publish_version += 1`
- Mark all previous versions as `status='superseded'`

**Failure handling:** If any step fails → UPDATE `published_versions` SET `status='failed'`. Retry up to 2 times (from queue re-push). After 3 failures → alert via email (Layer 5 concern).

**Dependencies:** Layer 1 (document schema, component registry `renderStatic`, theme system), Layer 0 (R2, Redis, database).

### Module 3.3: CDN Serving Worker (Days 56-60)

**Cloudflare Worker: `site-serve`**

Handles requests to `*.elove.me` and custom domains.

**Request flow (8 steps):**
1. Parse hostname from `Host` header
2. KV lookup: `ROUTING_TABLE[hostname]` → R2 prefix (e.g., `published/{pid}/v3/`)
3. If no match for custom domain: KV lookup `DNS_MAP[hostname]` → resolve to project slug → retry ROUTING_TABLE
4. If still no match → 404 page
5. Map URL path to file: `/` → `index.html`, `/our-story` → `our-story.html`
6. Fetch from R2: `GET r2://{prefix}/{filename}`
7. **Watermark injection (Layer 4 hook):** If tenant's plan = `free` → `HTMLRewriter` injects branding badge `<div class="elove-badge">` before `</body>`
8. Return response with headers:
   - `Cache-Control: public, max-age=31536000, immutable` for hashed assets (CSS, JS, images)
   - `Cache-Control: public, max-age=300` for HTML (5 min — allows quick re-publish)

**Dependencies:** Layer 0 (R2, KV), Module 3.2 (produces the files it serves). Layer 4 provides the watermark injection logic.

### Module 3.4: RSVP + Guestbook Edge Functions (Days 56-60)

Can be built concurrently with Module 3.3.

**CF Worker: `rsvp-submit`**

Route: `POST *.elove.me/__rsvp` or `POST {custom-domain}/__rsvp`

1. Parse JSON body: `{ guestName, email?, attending, partySize, mealChoice?, dietaryNotes?, customAnswers? }`
2. Resolve `project_id` from hostname via KV routing
3. Validate against RSVP form schema (from document's `content.data.rsvp.formFields`)
4. **Quota check (Layer 4 hook):** Read `quota_usage` WHERE `tenant_id` AND `quota_key='rsvp_count'`
   - If under limit: INSERT normally
   - If over limit but under 2× (soft quota): INSERT with `is_over_quota=true`, return success + `X-Quota-Warning: true`
   - If over 2× limit: return 503 "RSVP is temporarily unavailable"
5. INSERT into `rsvp_responses`
6. Increment `quota_usage` SET `current_value += party_size`
7. **Email trigger:** Queue email to project owner: "New RSVP from {guestName}" (Layer 5 concern)
8. Return `{ success: true, message: 'Cảm ơn bạn đã xác nhận!' }`

**CF Worker: `guestbook-submit`**

Route: `POST *.elove.me/__guestbook`

Similar flow but simpler: `{ authorName, message }`. Rate limit: 5 submissions per IP per hour (Cloudflare rate limiting). INSERT into `guestbook_entries`. Auto-approve by default (`is_approved=true`).

**Dependencies:** Layer 0 (database), Layer 1 (RSVP form schema from document), Layer 4 (quota check).

### Module 3.5: Custom Domain Routing (Days 60-65)

**Setup flow:**
1. User enters domain in dashboard: `our-wedding.com`
2. API: INSERT `custom_domains` row with `status='pending'`
3. API: call Cloudflare for SaaS API → create custom hostname → get `cf_hostname_id`
4. Return DNS instructions to user: "Add CNAME record: `our-wedding.com` → `proxy.elove.me`"
5. Background job (every 5 min): check Cloudflare API for SSL status
6. When SSL = active: UPDATE `custom_domains` SET `status='active'`, `ssl_status='active'`
7. UPDATE KV `DNS_MAP`: `our-wedding.com` → `{project_slug}.elove.me`
8. Site-serve worker now resolves custom domain requests

**Cost awareness:** $0.10/hostname/month via Cloudflare for SaaS. This is a Pro/Lifetime-only feature (Layer 4 gating).

**Dependencies:** Layer 0 (Cloudflare account), Module 3.3 (CDN worker resolves custom domains), Layer 4 (feature gating).

### Layer 3 Exit Criteria
- [ ] Publish request queues build job, state machine transitions correctly
- [ ] Build Worker executes 12-step pipeline in <60s for a 5-page project
- [ ] Published site loads at `{slug}.elove.me` with correct HTML/CSS/JS
- [ ] Hashed assets return `immutable` cache header, HTML returns 5-min TTL
- [ ] RSVP submissions persist to `rsvp_responses` with soft quota behavior
- [ ] Guestbook submissions persist with rate limiting
- [ ] Custom domain serves site after DNS verification + SSL provisioning
- [ ] Watermark injection placeholder exists (actual logic in Layer 4)

---

## Layer 4: Subscription Engine (Days 50-75)

Layer 4 is the paywall. Without it, the platform is a free tool with no revenue. Layer 4 wraps around Layers 1-3 by injecting entitlement checks at every critical path.

**Important:** Layer 4 starts at Day 50, overlapping with Layer 3. The Stripe integration and entitlement system can be built in parallel with the build worker and CDN serving.

### What Layer 4 Owns

| Module | Tables | R2 Paths | API/Workers |
|---|---|---|---|
| Stripe integration | `subscriptions`, `webhook_events`, `billing_events` | — | `billing.createCheckout`, `billing.webhookHandler` |
| Entitlement engine | `plans`, `plan_entitlements`, `entitlement_overrides` | — | Middleware on ALL gated endpoints |
| Quota enforcement | `quota_usage` | — | Redis counters + PostgreSQL reconciliation |
| Feature gating (client) | — | — | `<FeatureGate>` React component |
| Feature gating (API) | — | — | `requireEntitlement()` middleware |
| Feature gating (edge) | — | — | Watermark injection in site-serve Worker |
| Grace period | `subscriptions.grace_period_end` | — | Cron job |

### Module 4.1: Stripe Integration (Days 50-56)

**`billing.createCheckout({ planId, billingCycle })`:**
- `planId='pro'` + `billingCycle='monthly'` → Stripe Checkout Session with `mode='subscription'`, price from `plans.stripe_price_ids.monthly`
- `planId='pro'` + `billingCycle='yearly'` → same, price from `stripe_price_ids.yearly`
- `planId='lifetime'` → Stripe Checkout Session with `mode='payment'`, price from `stripe_price_ids.lifetime`
- Return Checkout Session URL → redirect user

**`billing.createPortalSession()`:**
- Create Stripe Customer Portal session for self-service: update payment method, cancel subscription, view invoices
- Only for `billing_type='recurring'` subscriptions (lifetime users manage via support)

**`billing.webhookHandler` (POST /webhooks/stripe):**

Process 8 event types with idempotent deduplication via `webhook_events` table:

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Create/update `subscriptions` row. If lifetime: `status='lifetime'`. If recurring: `status='active'`. Sync entitlements to Redis `ENTITLEMENT_CACHE`. |
| `invoice.paid` | Update `current_period_start/end`. Log to `billing_events`. |
| `invoice.payment_failed` | Set `status='past_due'`. Queue email: "Payment failed". |
| `customer.subscription.updated` | Sync plan changes (upgrade/downgrade). Recalculate entitlements. |
| `customer.subscription.deleted` | Set `status='grace_period'`, `grace_period_end = now() + 14 days`. Queue email: "Subscription canceled". |
| `charge.refunded` (lifetime) | Immediate downgrade: `status='canceled'`, `plan_id='free'`. No grace period. |
| `customer.subscription.trial_will_end` | Queue email: "Trial ending in 3 days". |
| `charge.dispute.created` | Flag tenant: `trust_score -= 30`. Alert admin. |

**Idempotency:** Before processing, check `webhook_events` WHERE `stripe_event_id`. If exists → skip. If not → INSERT with `status='processing'` → process → UPDATE `status='processed'`.

**Dependencies:** Layer 0 (database, Redis), Stripe account setup (API keys, webhook endpoint, product/price creation).

### Module 4.2: Entitlement Engine (Days 56-62)

**Entitlement resolution chain (per request):**

1. Check Redis `ENTITLEMENT_CACHE:{tenant_id}:{feature_key}` (5-min TTL)
2. If cache miss → query DB:
   ```sql
   SELECT COALESCE(eo.value, pe.value) as value
   FROM plan_entitlements pe
   JOIN subscriptions s ON s.plan_id = pe.plan_id AND s.tenant_id = $1
   LEFT JOIN entitlement_overrides eo ON eo.tenant_id = $1 AND eo.feature_key = pe.feature_key
     AND (eo.expires_at IS NULL OR eo.expires_at > now())
   WHERE pe.feature_key = $2
   ```
3. Cache result in Redis for 5 min
4. Return `{ featureKey, value, source: 'plan' | 'override' }`

**Where entitlement checks are injected:**

| Gated Operation | Feature Key | Check Location | Failure Response |
|---|---|---|---|
| Create project | `max_projects` | `projects.create` API | 403 `upgrade_required` |
| Add page | `max_pages` | `ADD_PAGE` command API | 403 `upgrade_required` |
| Add section | `max_sections_page` | `ADD_SECTION` command API | 403 `upgrade_required` |
| Upload media | `max_media_bytes` | `media.getUploadUrl` API | 403 `upgrade_required` |
| Publish | `max_publishes_day` | `projects.publish` API | 403 `upgrade_required` |
| Custom domain | `custom_domain` | `domains.create` API | 403 `upgrade_required` |
| AI features | `ai_features` | AI endpoint middleware | 403 `upgrade_required` |
| RSVP submission | `max_rsvp` | RSVP edge function | soft/hard quota |
| Remove branding | `remove_branding` | site-serve Worker | inject/skip badge |

**Dependencies:** Layer 0 (database, Redis), Module 4.1 (subscription status determines plan).

### Module 4.3: Quota Enforcement (Days 58-64)

**Dual-source quota system:**

- **Redis** (real-time, atomic): `INCR quota:{tenant_id}:{key}` on every mutation. `DECR` on delete.
- **PostgreSQL** (durable, reconciliation): `quota_usage` table, updated every 15 minutes by cron.

**Hard quotas** (projects, pages, media, publishes/day):
- Check Redis counter before operation
- If over limit → 403 immediately, operation not attempted
- `publishes/day` counter: key `quota:{tid}:publishes:{YYYY-MM-DD}`, TTL 86400s

**Soft quotas** (RSVP):
- If `current_value < limit` → accept normally
- If `limit ≤ current_value < 2×limit` → accept, flag `is_over_quota=true`, return `X-Quota-Warning`
- If `current_value ≥ 2×limit` → reject (503, not 403 — the guest shouldn't see an "upgrade" message)

**Reconciliation cron (every 15 min):**
- For each tenant with Redis quota keys:
  - Recount actual values from source tables (`SELECT count(*) FROM projects WHERE tenant_id = ...`)
  - If Redis counter drifted → correct Redis to match database
  - Update `quota_usage` table with authoritative count

**Dependencies:** Layer 0 (Redis, database), Module 4.2 (entitlement limits).

### Module 4.4: Feature Gating — Three Layers (Days 62-70)

**Client layer — `<FeatureGate>` React component:**
```
<FeatureGate feature="custom_domain" fallback={<UpgradePrompt plan="pro" />}>
  <CustomDomainSettings />
</FeatureGate>
```
- Reads from `EntitlementContext` (populated on app load from `/api/entitlements`)
- UI-only: hides or disables gated features. Not a security boundary.
- Shows upgrade prompts with plan comparison

**API layer — `requireEntitlement()` middleware:**
- Injected before route handlers on all gated endpoints
- Calls Module 4.2 resolution chain
- Returns 403 `{ error: 'upgrade_required', feature: 'custom_domain', current_plan: 'free', required_plan: 'pro' }`
- This IS the security boundary

**Edge layer — Watermark injection:**
- In site-serve Worker (Module 3.3): after fetching HTML from R2
- Check Redis `ENTITLEMENT_CACHE:{tenant_id}:remove_branding`
- If `false` (free plan): `HTMLRewriter` appends badge before `</body>`:
  ```html
  <div class="elove-badge" style="position:fixed;bottom:12px;right:12px;z-index:9999;">
    <a href="https://elove.me?ref=badge" target="_blank">Made with ELove</a>
  </div>
  ```
- If `true` (pro/lifetime): no injection

**Dependencies:** Module 4.2 (entitlement resolution), Module 3.3 (CDN Worker for edge injection), Module 4.1 (subscription status).

### Module 4.5: Grace Period + Trial (Days 68-75)

**Grace period (14 days after cancellation):**
- Triggered by `customer.subscription.deleted` webhook
- `subscriptions` SET `status='grace_period'`, `grace_period_end = now() + 14 days`
- During grace period: ALL Pro features remain active. No degradation.
- At grace period end (cron job, runs hourly):
  - SET `status='canceled'`, `plan_id='free'`
  - Flush `ENTITLEMENT_CACHE:{tenant_id}:*`
  - Published sites: inject branding badge on next request (automatic via entitlement check in site-serve Worker)
  - Projects over free limit: remain accessible read-only but cannot publish
  - Media over 50MB: soft-block uploads but don't delete existing

**Lifetime refund edge case:**
- `charge.refunded` webhook for lifetime payment
- Immediate downgrade: `status='canceled'`, `plan_id='free'`
- No grace period (the user got their money back)

**Trial system:**
- On signup: `status='trialing'`, `trial_end = now() + 7 days`, `plan_id='pro'`
- All Pro entitlements active during trial
- Day 4: email "Trial ending in 3 days"
- Day 7: if no conversion → `status='active'`, `plan_id='free'`

**Dependencies:** Module 4.1 (webhook events), Module 4.2 (entitlement cache flush), Module 4.3 (quota re-evaluation on downgrade).

### Layer 4 Exit Criteria
- [ ] Stripe Checkout creates subscription, one-time payment for lifetime
- [ ] All 8 webhook events processed idempotently, subscription state correct
- [ ] Entitlement resolution returns correct value for all 12 feature keys across 3 plans
- [ ] Hard quotas block operations at limit, soft RSVP quota allows 2× overflow
- [ ] `<FeatureGate>` hides Pro features for free users, shows upgrade prompt
- [ ] API middleware returns 403 for gated operations on free plan
- [ ] Watermark appears on free-plan published sites, absent on Pro/Lifetime
- [ ] Grace period: 14 days active after cancellation, then downgrade
- [ ] Lifetime refund: immediate downgrade, no grace period

---

## Layer 5: Growth Engine (Days 70-90+)

Layer 5 turns users into revenue and revenue into more users. Without it, the platform works but doesn't grow.

### What Layer 5 Owns

| Module | Tables | R2 Paths | API/Workers |
|---|---|---|---|
| Transactional email | — | — | Resend API integration |
| Template marketplace | `templates`, `template_versions` | `templates/` | `templates.submit`, `templates.review` |
| Analytics dashboard | — | — | CF Analytics Engine queries |
| Conversion triggers | — | — | Client-side hooks |
| Admin dashboard | — | — | Internal React SPA |
| Monitoring | — | — | Sentry, Axiom, Checkly |

### Module 5.1: Transactional Email (Days 70-74)

**8 email types via Resend (React Email templates):**

| Email | Trigger | Data Required |
|---|---|---|
| Welcome | User registration (Layer 0) | `{ userName, loginUrl }` |
| Trial ending | 3 days before `trial_end` (cron) | `{ userName, daysLeft, upgradeUrl }` |
| Payment failed | `invoice.payment_failed` webhook (L4) | `{ userName, retryUrl, portalUrl }` |
| Payment succeeded | `invoice.paid` webhook (L4) | `{ userName, amount, receiptUrl }` |
| Project published | Publish complete (L3 step 12) | `{ projectTitle, siteUrl }` |
| RSVP received | RSVP submission (L3) | `{ guestName, attending, projectTitle, dashboardUrl }` |
| Custom domain setup | Domain created (L3) | `{ domain, dnsInstructions }` |
| Account deactivated | Grace period expired (L4) | `{ userName, reactivateUrl }` |

**Implementation:** Event bus pattern. Each trigger (webhook, cron, API action) emits an event. Email service subscribes and sends via Resend API. Failed sends retry 3× with exponential backoff.

**Dependencies:** All layers emit events that trigger emails.

### Module 5.2: Conversion Triggers (Days 74-78)

**7 conversion leverage points (from blueprint):**

| Trigger | Location | Action |
|---|---|---|
| Section limit hit | Editor, `ADD_SECTION` command | Show "Unlock unlimited sections with Pro" modal |
| Project limit hit | Dashboard, "New Project" button | Show "Upgrade to create more invitations" modal |
| Custom domain click | Project settings | Show "Custom domains are a Pro feature" inline |
| Branding badge seen | Published site footer | Badge links to `elove.me?ref=badge&project={slug}` |
| Publish limit hit | Editor, publish button | Show "You've used 3/3 publishes today. Upgrade for unlimited." |
| Template locked | Template gallery | Overlay: "Pro template — Upgrade to use" |
| Trial countdown | Dashboard header | Banner: "3 days left in your Pro trial — Keep all features" |

Each trigger logs to `billing_events` table: `{ event_type: 'conversion_trigger', metadata: { trigger, plan, dismissed } }` for funnel analysis.

**Dependencies:** Layer 4 (entitlement checks determine when triggers fire), Layer 2 (editor UI shows modals).

### Module 5.3: Analytics Dashboard (Days 76-82)

**For project owners (inside dashboard):**
- Page views (from CF Analytics Engine): total, per page, per day
- RSVP stats: `SELECT attending, count(*), sum(party_size) FROM rsvp_responses WHERE project_id GROUP BY attending`
- Guestbook count: `SELECT count(*) FROM guestbook_entries WHERE project_id`
- Pro users get: geo breakdown, device breakdown, referrer sources (all from CF Analytics Engine)

**Implementation:** CF Analytics Engine stores zero-JS beacon hits from published sites. Query via CF API. Dashboard component fetches and renders charts.

**Dependencies:** Layer 3 (Analytics Engine beacon injection in published HTML), Layer 4 (analytics_tier entitlement gates detail level).

### Module 5.4: Admin Dashboard (Days 78-85)

**Internal tool for platform operators. NOT user-facing.**

| Admin Function | Data Source | Actions |
|---|---|---|
| User management | `tenants`, `users`, `subscriptions` | View, search, suspend |
| Subscription override | `entitlement_overrides` | Grant temporary Pro access, extend trial |
| Content moderation | `projects` (published) | Review flagged projects, unpublish |
| Template review | `templates` WHERE `status='review'` | Approve/reject marketplace submissions |
| Webhook retry | `webhook_events` WHERE `status='failed'` | Manual re-process |
| System health | Axiom logs, Checkly status | View error rates, uptime, build queue depth |
| Revenue dashboard | `billing_events`, `subscriptions` | MRR, churn, lifetime ratio |

**Implementation:** Separate React SPA at `admin.elove.me`. Auth: admin role check on `users.role`. Protected by both auth middleware and network ACL (IP whitelist or VPN).

**Dependencies:** All layers provide data to admin dashboard.

### Module 5.5: Monitoring + Observability (Days 80-85)

| Tool | Purpose | Integration Point |
|---|---|---|
| Sentry | Error tracking | All services: Core API, Build Worker, CF Workers |
| Axiom | Log aggregation | Structured logs from all services via HTTPS drain |
| Checkly | Uptime monitoring | Health endpoints: `/health` (API), `{slug}.elove.me` (CDN) |

**Key alerts:**
- Build queue depth > 50 jobs → Slack alert
- Build P95 duration > 45s → Slack alert
- Error rate > 1% on any Worker → PagerDuty
- Stripe webhook failures > 3 consecutive → PagerDuty
- R2 PUT failures → immediate alert (data loss risk)

**Dependencies:** All layers instrument to monitoring.

### Module 5.6: Template Marketplace — Phase 1 (Days 85-90+)

**Submission flow:**
1. Creator uploads template bundle via admin-facing UI
2. Stage 1 (automated): Zod schema validation against Layer 1 document schema. Check all component types exist in registry. Validate theme tokens complete.
3. Stage 2 (automated): Build Worker runs publish pipeline on template with dummy content. Must produce valid HTML in <60s.
4. Stage 3 (manual): Admin reviews rendered output. Approve → `status='published'`. Reject → `status='rejected'` with reason.

**No Lighthouse for now** (per blueprint O6 simplification). Add when marketplace exceeds 100 templates.

**Dependencies:** Layer 1 (template schema), Layer 3 (build worker for test builds), Module 5.4 (admin dashboard for review).

### Layer 5 Exit Criteria
- [ ] All 8 email types send correctly via Resend
- [ ] Conversion triggers fire at correct moments, log to `billing_events`
- [ ] Project analytics show page views, RSVP counts, guestbook counts
- [ ] Admin can view/search users, override entitlements, review templates
- [ ] Sentry captures errors from all services
- [ ] At least 3 system templates available in marketplace

---

## Cross-Layer Dependency Map

```
Layer 0 (Infrastructure)
  ↓ provides: DB, R2, Redis, Auth, CI/CD
Layer 1 (Template Engine)
  ↓ provides: ProjectDocument schema, Theme, ComponentRegistry, templates.instantiate
Layer 2 (Editor Engine)
  ↓ provides: Visual editing, autosave, validated documents, media management
  ↓ consumes from L4: entitlement checks on ADD_SECTION, ADD_PAGE, media upload
Layer 3 (Publishing Engine)
  ↓ provides: Live static sites, RSVP/guestbook, domain routing
  ↓ consumes from L1: document schema, renderStatic, theme compilation
  ↓ consumes from L2: validated documents in R2
  ↓ consumes from L4: publish quota check, watermark injection, RSVP soft quota
Layer 4 (Subscription Engine)
  ↓ provides: Stripe billing, entitlements, quotas, feature gating
  ↓ consumes from L0: database (subscriptions, plans, entitlements tables)
  ↓ injects into: L1 (project create quota), L2 (section/page limits), L3 (publish quota, watermark, RSVP quota)
Layer 5 (Growth Engine)
  ↓ provides: Email, analytics, conversion, admin, monitoring, marketplace
  ↓ consumes from: ALL layers
```

### Critical Path (longest dependency chain)

```
DB schema (D1) → Auth (D3) → Project CRUD (D8) → Document model (D10) →
Component registry (D13) → DOM renderer (D30) → Autosave (D34) →
Publish pipeline (D56) → CDN serving (D60) → Stripe integration (D56*) →
Feature gating (D70) → Beta launch (D90)

* Stripe work starts at D50, parallel to L3
```

---

## Parallel Work Streams

| Stream | Days | Modules | Team Member |
|---|---|---|---|
| **A: Foundation + API** | 1-21 | L0 all, L1 all (schema, CRUD, templates) | Backend lead |
| **B: Editor** | 22-45 | L2 all (shell, commands, renderers, autosave) | Frontend lead |
| **C: Publishing** | 46-65 | L3.1-3.3 (pipeline, build worker, CDN) | Backend lead |
| **D: Edge + Interactive** | 46-65 | L3.4-3.5 (RSVP, guestbook, custom domains) | Fullstack |
| **E: Billing** | 50-75 | L4 all (Stripe, entitlements, quotas, gating) | Backend lead or Fullstack |
| **F: Growth** | 70-90 | L5 all (email, analytics, admin, monitoring) | Fullstack |

**Minimum viable team:** 2 developers (1 backend-heavy, 1 frontend-heavy) can deliver in 90 days if:
- Backend lead handles Streams A → C → E
- Frontend lead handles Stream B → D → F
- Overlap periods (Days 50-65) require coordination on Layer 4 hook injection points

---

## Milestone Summary

| Day | Milestone | Validation |
|---|---|---|
| 7 | **Infrastructure live** | DB seeded, R2 writable, auth works, CI/CD deploys |
| 14 | **Project CRUD** | Create project from template, document stored in R2, metadata in PostgreSQL |
| 21 | **Template engine complete** | 3 themes resolve, component registry has 7 types, Zod validates all templates |
| 30 | **Editor shell + 6 commands** | Stack-layout sections render, text editing works, undo/redo functional |
| 35 | **Full editor MVP** | All 12 commands, Konva renderer, autosave every 2s to R2 |
| 45 | **Media + validation** | Upload images, generate thumbnails, 3-level validation catches invalid docs |
| 56 | **Build pipeline** | 12-step render produces valid HTML/CSS/JS from project document |
| 60 | **Sites live on CDN** | `{slug}.elove.me` serves published site, RSVP submissions work |
| 65 | **Custom domains** | `our-wedding.com` serves site after DNS verification |
| 70 | **Stripe billing active** | Checkout, webhooks, subscription lifecycle complete |
| 75 | **Full gating** | Free/Pro/Lifetime entitlements enforced at UI + API + edge |
| 80 | **Emails + analytics** | 8 transactional emails, project analytics dashboard |
| 85 | **Admin + monitoring** | Admin can manage users/templates, Sentry/Axiom/Checkly active |
| 90 | **Beta launch** | 3 templates, 3 plans, subdomain + custom domain publishing, full billing |

---

## Risk Register (Execution-Specific)

| Risk | Impact | Mitigation |
|---|---|---|
| Konva renderer takes longer than estimated (free-layout is complex) | L2 delayed by 1-2 weeks | Ship with stack/grid only for MVP. Free-layout as fast-follow. |
| Stripe webhook edge cases (partial refunds, disputes, currency issues) | L4 bugs post-launch | Build comprehensive webhook test suite with Stripe CLI mock events before launch. |
| Build Worker performance on image-heavy projects (100 images × 3 srcset) | L3 publish >60s timeout | Lazy variant generation: only process images that changed since last publish. Cache variants in R2. |
| Custom domain SSL provisioning delays (Cloudflare for SaaS can take hours) | Bad UX on domain setup | Show clear status page with polling. Email user when SSL is ready. Don't promise "instant." |
| Single developer bottleneck on backend (Streams A → C → E are all backend) | Schedule slip | Prioritize L4 Stripe webhook handler for early parallel dev. It only needs L0 (DB + Redis), not L1-L3. |

---

## What Is NOT In This Plan

Explicitly deferred to post-launch (Day 91+):

- AI content injection (text generation, image enhancement)
- Referral system (schema exists in `subscriptions.referral_code`, logic deferred)
- Template marketplace creator portal (admin-only for now)
- CRDT real-time collaboration (Yjs removed per blueprint O5)
- A/B variant system (removed per blueprint O2)
- Priority build queue lanes (removed per blueprint O7, add when P95 >30s)
- Lighthouse in marketplace pipeline (removed per blueprint O6, add when >100 templates)
- Advanced animations (parallax, scroll-trigger — GSAP integration is in plan, advanced choreography is not)
- Multi-language support (i18n infrastructure not designed)
- Mobile app (React Native wrapper — future consideration)

---

## Architecture Decisions (Interview — March 4, 2026)

Các quyết định dưới đây được xác lập qua phỏng vấn thiết kế. Mỗi item là một gap hoặc ambiguity trong plan gốc, đã được resolve thành quyết định cụ thể.

---

### AD-01: Autosave Failure Recovery

**Vấn đề:** R2 PUT có thể thất bại giữa chừng. Client đã advance `edit_revision` lên 47 nhưng R2 vẫn ở revision 45. User không biết và tiếp tục edit.

**Quyết định:** Hai lớp bảo vệ song song:
1. **IndexedDB fallback buffer** — Mọi autosave ghi vào IndexedDB *trước* khi ghi R2. Nếu R2 fail, IndexedDB giữ bản backup. Sync lại R2 khi kết nối recover.
2. **Retry với exponential backoff** — 3 lần retry (1s, 3s, 10s). Sau 3 lần thất bại: hiển thị banner `"Lưu thất bại — đang thử lại"` và block publish button cho đến khi sync thành công.

**Không dùng:** Optimistic local-first mà không có persistent fallback — quá rủi ro khi tab đóng.

---

### AD-02: Responsive Image Generation — Timing

**Vấn đề:** Build Worker Step 3 gọi Sharp để generate 640w/1024w/1440w variants cho mọi ảnh. 30 ảnh × 3 variants = có thể mất 20-30s, phá vỡ target <60s.

**Quyết định:** **Pre-generate ngay khi user upload** (Module 2.6 `media.confirmUpload`).

- Sau khi `confirmUpload` thành công: background job trên Fly.io chạy Sharp, tạo 3 variants, upload lên R2 tại `media/{tid}/{mid}/640w.webp`, `1024w.webp`, `1440w.webp`.
- `media` table thêm column `variants_ready: boolean` (mặc định `false`, set `true` sau khi job xong).
- Build Worker Step 3: nếu `variants_ready=true` → dùng URLs đã có sẵn. Nếu `false` → fallback: dùng original + `srcset` chỉ có 1 entry (không block build).

**Lý do:** Build pipeline cần predictable latency. Image processing cost thuộc về upload flow, không phải publish flow.

---

### AD-03: Document Schema Migration

**Vấn đề:** `document.json` trên R2 được tạo từ nhiều phiên bản schema khác nhau khi schema evolve.

**Quyết định:** **Version field + read-time migration**.

- `document.json` thêm field `schema_version: number` (bắt đầu từ `1`).
- Mỗi lần load document (trong editor, build worker): nếu `schema_version < CURRENT_SCHEMA_VERSION` → chạy migration chain `migrate_v1_to_v2()`, `migrate_v2_to_v3()`, v.v.
- Sau migrate: autosave lại document đã upgrade lên R2 (ghi đè, không tạo version mới).
- Migration functions nằm trong shared package, dùng chung bởi editor client và build worker.

**Không dùng:** Additive-only — vỡ khi cần rename hay restructure. Batch job — quá rủi ro ở scale.

---

### AD-04: Template Update Propagation

**Vấn đề:** Khi template Elegant được update (fix lỗi, improve layout), các project đã tạo từ template này không nhận được update.

**Quyết định:** **Snapshot at creation — không propagate**.

- `projects` table ghi `template_id` + `template_version` tại thời điểm tạo project.
- Template evolve độc lập. Project không bị ảnh hưởng.
- User muốn layout mới → tạo project mới từ template mới (có thể copy-paste content thủ công).

**Post-MVP (Day 91+):** Opt-in notification "Template có bản mới — xem có muốn merge không?" — chỉ merge structural/theme changes, giữ nguyên content.

---

### AD-05: JWT Refresh Strategy Trong Editor

**Vấn đề:** JWT access token expire sau 15-60 phút. User edit trong 4 tiếng → autosave gửi 401 → data không được save.

**Quyết định:** Kết hợp hai cơ chế:
1. **Silent refresh (primary):** Client chạy timer, proactive refresh 5 phút trước khi JWT expire. Gọi `/auth/refresh` với refresh token, nhận JWT mới. Hoàn toàn transparent với user.
2. **401 handler (fallback):** Nếu silent refresh fail (network, server restart): khi autosave nhận 401 → stop autosave queue → hiển thị modal `"Phiên đăng nhập hết hạn — Đăng nhập lại để lưu"` → giữ nguyên document trong memory → sau khi login lại, resume autosave queue ngay lập tức.

**Không dùng:** Long-lived session token — rủi ro bảo mật, không phù hợp JWT stateless model.

---

### AD-06: Free-Layout Mobile Responsive Strategy

**Vấn đề:** Konva canvas 1200px wide. HTML absolute positioning từ Konva coordinates không responsive tự nhiên trên mobile (390px).

**Quyết định:** **CSS `transform: scale()` cho MVP**.

- Published site wrap mỗi free-layout section trong container có `overflow: hidden`.
- JavaScript snippet nhỏ (~1KB) tính `scale = viewport.width / 1200`, áp dụng `transform: scale(scale); transform-origin: top left`.
- Container height = `1200 * scale * original_section_height_px / 1200`.
- Giới hạn: text scale nhỏ trên mobile nhưng layout giữ đúng.

**Post-MVP:** Dual canvas trong editor (Desktop / Mobile toggle) — user design layout riêng cho mobile. Lưu 2 bộ coordinates trong `position.desktop` và `position.mobile`.

---

### AD-07: Lifetime Plan Pricing + Seat Limit

**Vấn đề:** Lifetime là one-time payment. Nếu quá nhiều user chọn Lifetime, MRR thấp trong khi server costs tăng.

**Quyết định:**
- **Giá:** ~1.5 triệu VND (≈$60 USD) — tương đương 5-6 tháng Pro.
- **Seat limit:** 500 Lifetime seats. Sau khi hết → Lifetime option biến mất, chỉ còn Pro subscription.
- **Scarcity UX:** Dashboard hiển thị `"Còn {X} suất Lifetime"` khi dưới 100 seats.
- **Stripe config:** Lifetime dùng `mode='payment'` + một `stripe_price_id` riêng. Track seats bằng `SELECT count(*) FROM subscriptions WHERE plan_id='lifetime'`.

---

### AD-08: Tenant Isolation Strategy

**Vấn đề:** Plan gốc không specify RLS hay application-level filtering. Quên `WHERE tenant_id` trong 1 query → data leak.

**Quyết định:** **Hybrid — RLS cho sensitive tables, app-level cho public data**.

**Tables có PostgreSQL Row Level Security:**
- `projects`, `published_versions`, `media`, `rsvp_responses`, `guestbook_entries`, `subscriptions`, `quota_usage`, `webhook_events`, `billing_events`, `entitlement_overrides`
- RLS policy: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`
- Connection pool set `SET app.tenant_id = $tenantId` trước mỗi query.

**Tables không cần RLS (public/shared data):**
- `templates`, `template_versions`, `plans`, `plan_entitlements`

**Test coverage:** Integration tests kiểm tra tất cả endpoints không leak cross-tenant data.

---

### AD-09: Slug Collision Resolution

**Vấn đề:** Hai user cùng muốn slug `wedding` → collision trên global unique URL space.

**Quyết định:** **First-come-first-served + real-time availability check + auto-suggest**.

- Slug là globally unique (UNIQUE constraint trên `projects.slug`).
- Khi user gõ slug trong "Create Project" form: debounce 400ms → call `projects.checkSlugAvailability({ slug })`.
- Nếu taken: hiển thị `"'wedding' đã được sử dụng"` + gợi ý 3 alternatives: `wedding-2026`, `{firstName}-{lastName}`, `{firstName}-{lastName}-wedding`.
- Insert sử dụng `INSERT ... WHERE NOT EXISTS` + retry nếu race condition.

---

### AD-10: Build Worker Scaling Policy

**Vấn đề:** Execution plan nói "Fly.io 2-vCPU machine" nhưng không có autoscale policy.

**Quyết định:** **Fixed pool cho MVP, autoscale khi cần**.

**MVP (Days 1-90):**
- 2 Fly.io machines luôn chạy (`min_machines_running = 2`).
- Mỗi machine chạy 1 BLPOP loop (sequential per machine, 2 concurrent builds max).
- Chi phí: ~$20-30/tháng.

**Scale trigger (post-MVP):**
- Cron mỗi 60s: check `LLEN build_jobs` (Redis queue depth).
- Nếu queue > 5 và tất cả workers đang busy → scale up +1 machine (max 8).
- Nếu queue = 0 liên tục 10 phút → scale down về 2.

**Monitoring:** Alert khi queue depth > 20 jobs (Slack) hoặc P95 build time > 45s (PagerDuty).

---

### AD-11: Guestbook Moderation

**Vấn đề:** Auto-approve mặc định → spam/nội dung không phù hợp xuất hiện trực tiếp trên trang cưới.

**Quyết định:** **Auto-approve + word filter + chủ có thể xóa**.

- `guestbook_entries.is_approved = true` mặc định.
- Word filter: blacklist (~200 từ tục tựu tiếng Việt + tiếng Anh) applied trước khi insert. Nếu match → `is_approved = false`, không hiển thị, không báo lỗi cho guest.
- Rate limit: 3 submissions/IP/hour (Cloudflare rate limiting rule).
- Dashboard: tab "Sổ lưu niệm" với nút Delete cho từng entry.
- Published site: chỉ render entries có `is_approved = true`.

---

### AD-12: Target Market + Email Language

**Vấn đề:** Email templates không specify ngôn ngữ.

**Quyết định:** **Việt Nam primary + tiếng Anh fallback**.

- Tất cả 8 email templates: mặc định tiếng Việt.
- User settings có toggle `language: 'vi' | 'en'` (mặc định `vi`).
- Tất cả editor UI: tiếng Việt.
- Marketing site: tiếng Việt.
- Error messages và system text: tiếng Việt.
- **Không build full i18n framework** — 2 bản email template (vi/en) là đủ cho MVP.

---

### AD-13: RSVP Form Builder Scope

**Vấn đề:** Schema có `customAnswers` nhưng execution plan không mô tả UI để build custom form.

**Quyết định:** **Fixed fields only cho MVP**.

**MVP RSVP fields (cố định, không configurable):**
- Tên khách mời (required)
- Email (optional)
- Xác nhận tham dự: Có / Không (required)
- Số người tham dự (required, integer 1-10)
- Ghi chú thực phẩm/dị ứng (optional, text)

**`customAnswers` trong schema:** Giữ trong data model để future-compatible, nhưng UI form builder defer sang post-MVP.

**Post-MVP:** Drag-drop form builder trong property panel của editor — thêm/xóa/sắp xếp fields, đổi label, set required/optional.

---

### AD-14: Cache Purge Strategy On Publish

**Vấn đề:** HTML cache `max-age=300` (5 phút). User re-publish fix lỗi ngay trước ngày cưới → guests thấy phiên bản cũ 5 phút.

**Quyết định:** **Purge Cloudflare cache ngay sau khi build thành công**.

- Build Worker Step 12 (sau khi upload R2 xong): gọi Cloudflare Cache Purge API.
- Purge URLs: `https://{slug}.elove.me/`, `https://{slug}.elove.me/{page-slug}` cho tất cả pages của project.
- Nếu project có custom domain: purge cả `https://{custom-domain}/` và các pages.
- CF Cache Purge API: `POST /zones/{zone_id}/purge_cache` với danh sách URLs.
- Failure non-blocking: nếu purge fail, không fail build — user chỉ chờ max 5 phút.

---

### AD-15: Referral System Scope

**Vấn đề:** Layer 5 đề cập "referral system" nhưng không mô tả cơ chế. Ảnh hưởng đến schema và Stripe billing flow.

**Quyết định:** **Defer toàn bộ referral logic sang Day 91+. Chỉ dùng branding badge làm viral loop trong MVP.**

- Branding badge `"Made with ELove"` trên free sites link đến `https://elove.me?ref=badge&from={slug}` — đây là viral acquisition channel thực sự.
- `subscriptions.referral_code` column giữ trong schema (đã có), nhưng ứng dụng không đọc/ghi vào đó.
- Không build: referral code generation, referral tracking, discount logic, Stripe coupon integration.
- Ghi vào "What Is NOT In This Plan": referral code system (logic deferred, schema placeholder only).

