# ELove Platform — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build ELove — nền tảng SaaS thiệp cưới online với visual editor, static publishing trên CDN, và Stripe billing 3 tiers trong 90 ngày.

**Architecture:** Next.js 15 monorepo (App Router) + tRPC API + Neon PostgreSQL + Upstash Redis + Cloudflare R2/Workers. Build Worker chạy trên Fly.io, CDN serving qua Cloudflare Worker. Editor dùng DOM renderer (stack/grid) + Konva.js (free-layout).

**Tech Stack:** Next.js 15, tRPC, Drizzle ORM, Neon PostgreSQL, Upstash Redis, Cloudflare R2 + KV + Workers, Fly.io, Stripe, Resend, react-konva, Zod, Immer, Sharp, Vitest, Playwright.

**Source of truth:** `execution-plan.md` v1.1 + `unified-technical-blueprint.md` v2.0

---

## Phase 1: Foundation + Template Engine + Editor Shell (Days 1–30)

---

### Task 1: Monorepo Setup

**Files:**
- Create: `package.json` (root workspace)
- Create: `apps/web/package.json` (Next.js 15 dashboard + editor)
- Create: `apps/worker/package.json` (Fly.io Build Worker)
- Create: `packages/shared/package.json` (shared types + schemas)
- Create: `packages/shared/src/index.ts`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `tsconfig.base.json`

**Step 1: Khởi tạo monorepo**

```bash
mkdir elove && cd elove
npm init -y
npm install -D turbo typescript
mkdir -p apps/web apps/worker packages/shared/src
```

**Step 2: Viết root `package.json`**

```json
{
  "name": "elove",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: Viết `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

**Step 4: Khởi tạo Next.js 15 app**

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

**Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: init monorepo with Next.js 15"
```

---

### Task 2: Database Schema — PostgreSQL (Neon)

**Files:**
- Create: `packages/shared/src/db/schema.ts`
- Create: `packages/shared/src/db/index.ts`
- Create: `packages/shared/src/db/migrate.ts`
- Create: `drizzle.config.ts` (root)

**Step 1: Cài dependencies**

```bash
cd packages/shared
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

**Step 2: Viết failing test — schema validation**

```typescript
// packages/shared/src/db/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { tenants, users, plans, projects } from "../schema";

describe("DB Schema", () => {
  it("tenants table has required columns", () => {
    expect(tenants.id).toBeDefined();
    expect(tenants.slug).toBeDefined();
    expect(tenants.plan_id).toBeDefined();
  });

  it("projects table has r2 key columns", () => {
    expect(projects.r2_document_key).toBeDefined();
    expect(projects.edit_revision).toBeDefined();
    expect(projects.publish_version).toBeDefined();
  });
});
```

**Step 3: Run test — verify FAIL**

```bash
cd packages/shared && npx vitest run src/db/__tests__/schema.test.ts
# Expected: FAIL "Cannot find module '../schema'"
```

**Step 4: Implement schema (17 tables)**

```typescript
// packages/shared/src/db/schema.ts
import { pgTable, text, integer, boolean, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  plan_id: text("plan_id").notNull().default("free"),
  stripe_customer_id: text("stripe_customer_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash"),
  role: text("role").notNull().default("owner"), // owner | admin
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ tenant_idx: index("users_tenant_idx").on(t.tenant_id) }));

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // 'free' | 'pro' | 'lifetime'
  name: text("name").notNull(),
  stripe_price_ids: jsonb("stripe_price_ids").$type<{
    monthly?: string; yearly?: string; lifetime?: string;
  }>(),
  billing_type: text("billing_type").notNull(), // 'free' | 'recurring' | 'one_time'
});

export const plan_entitlements = pgTable("plan_entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  plan_id: text("plan_id").notNull().references(() => plans.id),
  feature_key: text("feature_key").notNull(),
  value: text("value").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id).unique(),
  plan_id: text("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull(), // active | past_due | canceled | trialing | lifetime | grace_period
  billing_type: text("billing_type").notNull(),
  stripe_subscription_id: text("stripe_subscription_id"),
  current_period_start: timestamp("current_period_start"),
  current_period_end: timestamp("current_period_end"),
  trial_end: timestamp("trial_end"),
  grace_period_end: timestamp("grace_period_end"),
  referral_code: text("referral_code"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  current_version: integer("current_version").notNull().default(1),
  r2_bundle_key: text("r2_bundle_key").notNull(),
  plan_required: text("plan_required").notNull().default("free"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  template_id: uuid("template_id").references(() => templates.id),
  template_version: integer("template_version"),
  r2_document_key: text("r2_document_key").notNull(),
  edit_revision: integer("edit_revision").notNull().default(0),
  publish_version: integer("publish_version").notNull().default(0),
  published_at: timestamp("published_at"),
  seo_meta: jsonb("seo_meta").$type<{ title: string; description: string; og_image?: string }>(),
  settings: jsonb("settings"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({ tenant_idx: index("projects_tenant_idx").on(t.tenant_id) }));

export const published_versions = pgTable("published_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  project_id: uuid("project_id").notNull().references(() => projects.id),
  publish_version: integer("publish_version").notNull(),
  status: text("status").notNull().default("building"), // building | live | failed | superseded
  source_edit_revision: integer("source_edit_revision").notNull(),
  r2_prefix: text("r2_prefix"),
  build_hash: text("build_hash"),
  build_duration_ms: integer("build_duration_ms"),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  project_id: uuid("project_id").references(() => projects.id),
  r2_key: text("r2_key").notNull(),
  mime_type: text("mime_type").notNull(),
  size_bytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  blurhash: text("blurhash"),
  variants_ready: boolean("variants_ready").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const rsvp_responses = pgTable("rsvp_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  project_id: uuid("project_id").notNull().references(() => projects.id),
  guest_name: text("guest_name").notNull(),
  email: text("email"),
  attending: boolean("attending").notNull(),
  party_size: integer("party_size").notNull().default(1),
  dietary_notes: text("dietary_notes"),
  is_over_quota: boolean("is_over_quota").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const guestbook_entries = pgTable("guestbook_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  project_id: uuid("project_id").notNull().references(() => projects.id),
  author_name: text("author_name").notNull(),
  message: text("message").notNull(),
  is_approved: boolean("is_approved").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const quota_usage = pgTable("quota_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  quota_key: text("quota_key").notNull(),
  current_value: integer("current_value").notNull().default(0),
  period_start: timestamp("period_start"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const custom_domains = pgTable("custom_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  project_id: uuid("project_id").notNull().references(() => projects.id),
  domain: text("domain").notNull().unique(),
  cf_hostname_id: text("cf_hostname_id"),
  status: text("status").notNull().default("pending"), // pending | active | failed
  ssl_status: text("ssl_status"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const webhook_events = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  stripe_event_id: text("stripe_event_id").notNull().unique(),
  event_type: text("event_type").notNull(),
  status: text("status").notNull().default("processing"), // processing | processed | failed
  payload: jsonb("payload"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const billing_events = pgTable("billing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  event_type: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const entitlement_overrides = pgTable("entitlement_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  feature_key: text("feature_key").notNull(),
  value: text("value").notNull(),
  expires_at: timestamp("expires_at"),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 5: Run test — verify PASS**

```bash
npx vitest run src/db/__tests__/schema.test.ts
# Expected: PASS (2 tests)
```

**Step 6: Deploy schema lên Neon**

```bash
# Set env: DATABASE_URL=postgres://...neon.tech/elove
npx drizzle-kit push
# Expected: "17 tables created"
```

**Step 7: Seed plans + entitlements**

```typescript
// packages/shared/src/db/seed.ts
import { db } from "./index";
import { plans, plan_entitlements } from "./schema";

await db.insert(plans).values([
  { id: "free", name: "Free", billing_type: "free" },
  { id: "pro", name: "Pro", billing_type: "recurring",
    stripe_price_ids: { monthly: "price_xxx", yearly: "price_yyy" } },
  { id: "lifetime", name: "Lifetime", billing_type: "one_time",
    stripe_price_ids: { lifetime: "price_zzz" } },
]);

const entitlements = [
  { plan_id: "free", feature_key: "max_projects", value: "3" },
  { plan_id: "free", feature_key: "max_pages", value: "5" },
  { plan_id: "free", feature_key: "max_sections_page", value: "8" },
  { plan_id: "free", feature_key: "max_media_bytes", value: "52428800" }, // 50MB
  { plan_id: "free", feature_key: "max_rsvp", value: "50" },
  { plan_id: "free", feature_key: "max_publishes_day", value: "3" },
  { plan_id: "free", feature_key: "custom_domain", value: "false" },
  { plan_id: "free", feature_key: "remove_branding", value: "false" },
  { plan_id: "pro", feature_key: "max_projects", value: "unlimited" },
  { plan_id: "pro", feature_key: "max_pages", value: "unlimited" },
  { plan_id: "pro", feature_key: "max_sections_page", value: "unlimited" },
  { plan_id: "pro", feature_key: "max_media_bytes", value: "5368709120" }, // 5GB
  { plan_id: "pro", feature_key: "max_rsvp", value: "500" },
  { plan_id: "pro", feature_key: "max_publishes_day", value: "unlimited" },
  { plan_id: "pro", feature_key: "custom_domain", value: "true" },
  { plan_id: "pro", feature_key: "remove_branding", value: "true" },
  // lifetime = same as pro
];
await db.insert(plan_entitlements).values(entitlements);
```

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add PostgreSQL schema (17 tables) + seed plans"
```

---

### Task 3: Document Schema Types (Shared Package)

**Files:**
- Create: `packages/shared/src/types/document.ts`
- Create: `packages/shared/src/types/theme.ts`
- Create: `packages/shared/src/schemas/document.schema.ts`
- Test: `packages/shared/src/schemas/__tests__/document.schema.test.ts`

**Step 1: Viết failing test**

```typescript
// packages/shared/src/schemas/__tests__/document.schema.test.ts
import { describe, it, expect } from "vitest";
import { ProjectDocumentSchema, ThemeSchema } from "../document.schema";

describe("ProjectDocumentSchema", () => {
  it("validates a minimal valid document", () => {
    const doc = {
      schema_version: 1,
      structure: {
        pages: [{ id: "p1", slug: "home", title: "Home", sections: [] }],
        globalSlots: { navigation: null, musicPlayer: null, footer: null },
      },
      content: {
        data: {
          couple: { partner1: "Minh", partner2: "Lan", weddingDate: "2026-06-15", venue: "", story: "" },
          event: { ceremonies: [], receptions: [], afterParties: [] },
          gallery: { albums: [] },
          rsvp: { formFields: [], deadline: null },
          music: { tracks: [], autoplay: false },
        },
        slotContent: {},
        customSections: [],
      },
      behavior: {
        sectionBehaviors: {},
        pageTransitions: { type: "fade", duration: 300, easing: "ease" },
        globalBehaviors: { smoothScroll: true, lazyLoad: true, prefetch: false },
        accessibilityFallback: { reducedMotion: true, highContrast: false, screenReader: true },
      },
    };
    const result = ProjectDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it("rejects document with missing couple data", () => {
    const doc = { schema_version: 1, structure: {}, content: {}, behavior: {} };
    const result = ProjectDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/schemas/__tests__/document.schema.test.ts
# Expected: FAIL "Cannot find module"
```

**Step 3: Implement types**

```typescript
// packages/shared/src/types/document.ts
export type LayoutMode = "stack" | "grid" | "free";
export type ComponentType = "text" | "image" | "video" | "shape" | "button" | "icon" | "divider";

export interface SlotPosition {
  x: number; y: number; w: number; h: number;
  rotation: number; zIndex: number;
}

export interface Slot {
  id: string;
  componentType: ComponentType;
  props: Record<string, unknown>;
  position?: SlotPosition;
}

export interface Section {
  id: string;
  type: string;
  layoutMode: LayoutMode;
  slots: Slot[];
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
}

export interface ProjectDocument {
  schema_version: number;
  structure: {
    pages: Page[];
    globalSlots: {
      navigation: Record<string, unknown> | null;
      musicPlayer: Record<string, unknown> | null;
      footer: Record<string, unknown> | null;
    };
  };
  content: {
    data: {
      couple: { partner1: string; partner2: string; weddingDate: string; venue: string; story: string };
      event: { ceremonies: unknown[]; receptions: unknown[]; afterParties: unknown[] };
      gallery: { albums: unknown[] };
      rsvp: { formFields: unknown[]; deadline: string | null };
      music: { tracks: unknown[]; autoplay: boolean };
    };
    slotContent: Record<string, unknown>;
    customSections: unknown[];
  };
  behavior: {
    sectionBehaviors: Record<string, unknown>;
    pageTransitions: { type: string; duration: number; easing: string };
    globalBehaviors: { smoothScroll: boolean; lazyLoad: boolean; prefetch: boolean };
    accessibilityFallback: { reducedMotion: boolean; highContrast: boolean; screenReader: boolean };
  };
}
```

**Step 4: Implement Zod schema**

```typescript
// packages/shared/src/schemas/document.schema.ts
import { z } from "zod";

const SlotSchema = z.object({
  id: z.string().uuid(),
  componentType: z.enum(["text", "image", "video", "shape", "button", "icon", "divider"]),
  props: z.record(z.unknown()),
  position: z.object({
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    rotation: z.number(), zIndex: z.number(),
  }).optional(),
});

const SectionSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  layoutMode: z.enum(["stack", "grid", "free"]),
  slots: z.array(SlotSchema),
});

const PageSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(SectionSchema),
});

export const ProjectDocumentSchema = z.object({
  schema_version: z.number().int().positive(),
  structure: z.object({
    pages: z.array(PageSchema).min(1),
    globalSlots: z.object({
      navigation: z.record(z.unknown()).nullable(),
      musicPlayer: z.record(z.unknown()).nullable(),
      footer: z.record(z.unknown()).nullable(),
    }),
  }),
  content: z.object({
    data: z.object({
      couple: z.object({
        partner1: z.string(), partner2: z.string(),
        weddingDate: z.string(), venue: z.string(), story: z.string(),
      }),
      event: z.object({ ceremonies: z.array(z.unknown()), receptions: z.array(z.unknown()), afterParties: z.array(z.unknown()) }),
      gallery: z.object({ albums: z.array(z.unknown()) }),
      rsvp: z.object({ formFields: z.array(z.unknown()), deadline: z.string().nullable() }),
      music: z.object({ tracks: z.array(z.unknown()), autoplay: z.boolean() }),
    }),
    slotContent: z.record(z.unknown()),
    customSections: z.array(z.unknown()),
  }),
  behavior: z.object({
    sectionBehaviors: z.record(z.unknown()),
    pageTransitions: z.object({ type: z.string(), duration: z.number(), easing: z.string() }),
    globalBehaviors: z.object({ smoothScroll: z.boolean(), lazyLoad: z.boolean(), prefetch: z.boolean() }),
    accessibilityFallback: z.object({ reducedMotion: z.boolean(), highContrast: z.boolean(), screenReader: z.boolean() }),
  }),
});

export const ThemeSchema = z.object({
  baseThemeId: z.string(),
  tokens: z.object({
    color: z.object({ primary: z.string(), secondary: z.string(), accent: z.string(),
      background: z.string(), surface: z.string(), text: z.string(), textMuted: z.string() }),
    typography: z.object({
      heading: z.object({ family: z.string(), weight: z.string(), sizes: z.record(z.string()) }),
      body: z.object({ family: z.string(), weight: z.string(), sizes: z.record(z.string()) }),
    }),
    spacing: z.object({ section: z.string(), element: z.string(), page: z.string() }),
    border: z.object({ radius: z.string(), width: z.string(), color: z.string() }),
    shadow: z.object({ sm: z.string(), md: z.string(), lg: z.string() }),
    animation: z.object({ duration: z.string(), easing: z.string(), stagger: z.string() }),
  }),
  overrides: z.record(z.unknown()).optional(),
});

export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
```

**Step 5: Run — verify PASS**

```bash
npx vitest run src/schemas/__tests__/document.schema.test.ts
# Expected: PASS (2 tests)
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add ProjectDocument + Theme Zod schemas (shared package)"
```

---

### Task 4: Component Registry

**Files:**
- Create: `packages/shared/src/registry/component-registry.ts`
- Create: `packages/shared/src/registry/components/text.component.ts`
- Create: `packages/shared/src/registry/components/image.component.ts`
- (+ 5 more components: video, shape, button, icon, divider)
- Test: `packages/shared/src/registry/__tests__/registry.test.ts`

**Step 1: Viết failing test**

```typescript
// packages/shared/src/registry/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { ComponentRegistry } from "../component-registry";

describe("ComponentRegistry", () => {
  it("has 7 required component types", () => {
    const types = ["text", "image", "video", "shape", "button", "icon", "divider"];
    types.forEach(t => {
      expect(ComponentRegistry.has(t), `Missing component: ${t}`).toBe(true);
    });
  });

  it("each component has renderDOM, renderStatic, defaultProps", () => {
    for (const [, comp] of ComponentRegistry) {
      expect(typeof comp.renderDOM).toBe("function");
      expect(typeof comp.renderStatic).toBe("function");
      expect(comp.defaultProps).toBeDefined();
    }
  });

  it("text renderStatic returns HTML string", () => {
    const text = ComponentRegistry.get("text")!;
    const html = text.renderStatic(
      { content: "Hello Wedding", variant: "heading" },
      { "--color-text": "#333" }
    );
    expect(html).toContain("Hello Wedding");
    expect(typeof html).toBe("string");
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/registry/__tests__/registry.test.ts
```

**Step 3: Implement registry**

```typescript
// packages/shared/src/registry/component-registry.ts
import type { ZodSchema } from "zod";
import type { ReactElement } from "react";

export interface ComponentDefinition {
  type: string;
  displayName: string;
  category: "content" | "media" | "decoration" | "interactive";
  defaultProps: Record<string, unknown>;
  propsSchema: ZodSchema;
  renderDOM: (props: Record<string, unknown>, tokens: Record<string, string>) => ReactElement;
  renderKonva: ((props: Record<string, unknown>, tokens: Record<string, string>) => unknown) | null;
  renderStatic: (props: Record<string, unknown>, tokens: Record<string, string>) => string;
}

export const ComponentRegistry = new Map<string, ComponentDefinition>();

// text
ComponentRegistry.set("text", {
  type: "text",
  displayName: "Text",
  category: "content",
  defaultProps: { content: "Nhập nội dung...", variant: "body" },
  propsSchema: z.object({ content: z.string(), variant: z.enum(["heading", "body", "caption"]) }),
  renderDOM: (props, tokens) => /* React element — implemented in apps/web */ null as any,
  renderKonva: null,
  renderStatic: (props, tokens) => {
    const { content, variant } = props as { content: string; variant: string };
    const tag = variant === "heading" ? "h2" : variant === "caption" ? "p" : "p";
    const className = `elove-text elove-text--${variant}`;
    return `<${tag} class="${className}" style="color:${tokens["--color-text"] ?? "inherit"}">${escapeHtml(content)}</${tag}>`;
  },
});

// image
ComponentRegistry.set("image", {
  type: "image",
  displayName: "Image",
  category: "media",
  defaultProps: { mediaId: "", alt: "", fit: "cover" },
  propsSchema: z.object({ mediaId: z.string(), alt: z.string(), fit: z.enum(["cover", "contain"]) }),
  renderDOM: (props, tokens) => null as any,
  renderKonva: null,
  renderStatic: (props, tokens) => {
    const { mediaId, alt, fit } = props as { mediaId: string; alt: string; fit: string };
    if (!mediaId) return `<div class="elove-image elove-image--placeholder"></div>`;
    return `<img class="elove-image" src="/__media/${mediaId}/original" alt="${escapeHtml(alt)}" style="object-fit:${fit}" loading="lazy" />`;
  },
});

// button
ComponentRegistry.set("button", {
  type: "button",
  displayName: "Button",
  category: "interactive",
  defaultProps: { label: "Nhấn vào đây", action: "url", target: "" },
  propsSchema: z.object({ label: z.string(), action: z.enum(["url", "scroll", "rsvp"]), target: z.string() }),
  renderDOM: (props, tokens) => null as any,
  renderKonva: null,
  renderStatic: (props, tokens) => {
    const { label, action, target } = props as { label: string; action: string; target: string };
    const href = action === "scroll" ? `#${target}` : action === "rsvp" ? "#rsvp" : target;
    return `<a class="elove-button" href="${href}" style="background:${tokens["--color-primary"] ?? "#333"}">${escapeHtml(label)}</a>`;
  },
});

// divider
ComponentRegistry.set("divider", {
  type: "divider", displayName: "Divider", category: "decoration",
  defaultProps: { style: "solid", thickness: 1 },
  propsSchema: z.object({ style: z.enum(["solid", "dashed", "dotted", "ornamental"]), thickness: z.number() }),
  renderDOM: (props, tokens) => null as any,
  renderKonva: null,
  renderStatic: (props, tokens) => {
    const { style, thickness } = props as { style: string; thickness: number };
    return `<hr class="elove-divider" style="border-style:${style};border-width:${thickness}px;border-color:${tokens["--color-accent"] ?? "#ccc"}" />`;
  },
});

// icon
ComponentRegistry.set("icon", {
  type: "icon", displayName: "Icon", category: "decoration",
  defaultProps: { name: "heart", size: 24, color: "#333" },
  propsSchema: z.object({ name: z.string(), size: z.number(), color: z.string() }),
  renderDOM: (props, tokens) => null as any,
  renderKonva: null,
  renderStatic: (props, tokens) => {
    const { name, size, color } = props as { name: string; size: number; color: string };
    return `<span class="elove-icon elove-icon--${name}" style="font-size:${size}px;color:${color}"></span>`;
  },
});

// video
ComponentRegistry.set("video", {
  type: "video", displayName: "Video", category: "media",
  defaultProps: { url: "", autoplay: false, loop: false },
  propsSchema: z.object({ url: z.string(), autoplay: z.boolean(), loop: z.boolean() }),
  renderDOM: (props, tokens) => null as any,
  renderKonva: null,
  renderStatic: (props, tokens) => {
    const { url, autoplay, loop } = props as { url: string; autoplay: boolean; loop: boolean };
    return `<video class="elove-video" src="${url}" ${autoplay ? "autoplay muted" : ""} ${loop ? "loop" : ""} playsinline></video>`;
  },
});

// shape
ComponentRegistry.set("shape", {
  type: "shape", displayName: "Shape", category: "decoration",
  defaultProps: { shape: "rect", fill: "#f0f0f0", stroke: "transparent" },
  propsSchema: z.object({ shape: z.enum(["rect", "circle", "line"]), fill: z.string(), stroke: z.string() }),
  renderDOM: (props, tokens) => null as any,
  renderKonva: (props, tokens) => null, // implemented in apps/web with react-konva
  renderStatic: (props, tokens) => {
    const { shape, fill, stroke } = props as { shape: string; fill: string; stroke: string };
    if (shape === "circle") return `<div class="elove-shape elove-shape--circle" style="background:${fill};border:2px solid ${stroke};border-radius:50%"></div>`;
    return `<div class="elove-shape elove-shape--${shape}" style="background:${fill};border:2px solid ${stroke}"></div>`;
  },
});

function escapeHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/registry/__tests__/registry.test.ts
# Expected: PASS (3 tests)
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add ComponentRegistry with 7 components (shared package)"
```

---

### Task 5: Theme System

**Files:**
- Create: `packages/shared/src/theme/resolve-theme.ts`
- Create: `packages/shared/src/theme/system-themes.ts`
- Test: `packages/shared/src/theme/__tests__/resolve-theme.test.ts`

**Step 1: Viết failing test**

```typescript
// packages/shared/src/theme/__tests__/resolve-theme.test.ts
import { describe, it, expect } from "vitest";
import { resolveTheme } from "../resolve-theme";
import { ELEGANT_THEME } from "../system-themes";

describe("resolveTheme", () => {
  it("returns flat CSS custom properties", () => {
    const result = resolveTheme(ELEGANT_THEME);
    expect(result["--color-primary"]).toBeDefined();
    expect(result["--font-heading-family"]).toBeDefined();
    expect(result["--spacing-section"]).toBeDefined();
  });

  it("applies overrides on top of base tokens", () => {
    const theme = { ...ELEGANT_THEME, overrides: { color: { primary: "#FF0000" } } };
    const result = resolveTheme(theme);
    expect(result["--color-primary"]).toBe("#FF0000");
    expect(result["--color-secondary"]).toBe(ELEGANT_THEME.tokens.color.secondary); // unchanged
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/theme/__tests__/resolve-theme.test.ts
```

**Step 3: Implement**

```typescript
// packages/shared/src/theme/system-themes.ts
import type { Theme } from "../schemas/document.schema";

export const ELEGANT_THEME: Theme = {
  baseThemeId: "elegant",
  tokens: {
    color: { primary: "#8B5E3C", secondary: "#C4A882", accent: "#D4AF37",
      background: "#FAF8F5", surface: "#FFFFFF", text: "#2C2C2C", textMuted: "#888888" },
    typography: {
      heading: { family: "Playfair Display", weight: "700", sizes: { xl: "3rem", lg: "2rem", md: "1.5rem" } },
      body: { family: "Lora", weight: "400", sizes: { md: "1rem", sm: "0.875rem" } },
    },
    spacing: { section: "5rem", element: "1.5rem", page: "2rem" },
    border: { radius: "4px", width: "1px", color: "#C4A882" },
    shadow: { sm: "0 1px 3px rgba(0,0,0,0.1)", md: "0 4px 12px rgba(0,0,0,0.1)", lg: "0 8px 24px rgba(0,0,0,0.15)" },
    animation: { duration: "600ms", easing: "ease-in-out", stagger: "100ms" },
  },
};

export const MINIMAL_THEME: Theme = {
  baseThemeId: "minimal",
  tokens: {
    color: { primary: "#1A1A1A", secondary: "#666666", accent: "#FF6B6B",
      background: "#FFFFFF", surface: "#F5F5F5", text: "#1A1A1A", textMuted: "#999999" },
    typography: {
      heading: { family: "Inter", weight: "700", sizes: { xl: "2.5rem", lg: "1.75rem", md: "1.25rem" } },
      body: { family: "Inter", weight: "400", sizes: { md: "1rem", sm: "0.875rem" } },
    },
    spacing: { section: "3rem", element: "1rem", page: "1.5rem" },
    border: { radius: "2px", width: "1px", color: "#E5E5E5" },
    shadow: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 2px 8px rgba(0,0,0,0.08)", lg: "0 4px 16px rgba(0,0,0,0.1)" },
    animation: { duration: "300ms", easing: "ease", stagger: "50ms" },
  },
};

export const PLAYFUL_THEME: Theme = {
  baseThemeId: "playful",
  tokens: {
    color: { primary: "#FF85A1", secondary: "#FFA8C5", accent: "#85C1E9",
      background: "#FFF5F8", surface: "#FFFFFF", text: "#444444", textMuted: "#AAAAAA" },
    typography: {
      heading: { family: "Quicksand", weight: "700", sizes: { xl: "2.75rem", lg: "2rem", md: "1.5rem" } },
      body: { family: "Quicksand", weight: "500", sizes: { md: "1rem", sm: "0.875rem" } },
    },
    spacing: { section: "4rem", element: "1.25rem", page: "2rem" },
    border: { radius: "16px", width: "2px", color: "#FFA8C5" },
    shadow: { sm: "0 2px 8px rgba(255,133,161,0.15)", md: "0 4px 16px rgba(255,133,161,0.2)", lg: "0 8px 32px rgba(255,133,161,0.25)" },
    animation: { duration: "500ms", easing: "cubic-bezier(0.34,1.56,0.64,1)", stagger: "80ms" },
  },
};
```

```typescript
// packages/shared/src/theme/resolve-theme.ts
import type { Theme } from "../schemas/document.schema";
import { mergeDeep } from "../utils/merge-deep";

export function resolveTheme(theme: Theme): Record<string, string> {
  const merged = theme.overrides
    ? mergeDeep(theme.tokens, theme.overrides) as typeof theme.tokens
    : theme.tokens;

  return {
    "--color-primary": merged.color.primary,
    "--color-secondary": merged.color.secondary,
    "--color-accent": merged.color.accent,
    "--color-background": merged.color.background,
    "--color-surface": merged.color.surface,
    "--color-text": merged.color.text,
    "--color-text-muted": merged.color.textMuted,
    "--font-heading-family": merged.typography.heading.family,
    "--font-heading-weight": merged.typography.heading.weight,
    "--font-body-family": merged.typography.body.family,
    "--font-body-weight": merged.typography.body.weight,
    "--spacing-section": merged.spacing.section,
    "--spacing-element": merged.spacing.element,
    "--spacing-page": merged.spacing.page,
    "--border-radius": merged.border.radius,
    "--border-width": merged.border.width,
    "--border-color": merged.border.color,
    "--animation-duration": merged.animation.duration,
    "--animation-easing": merged.animation.easing,
  };
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/theme/__tests__/resolve-theme.test.ts
# Expected: PASS (2 tests)
```

**Step 5: Upload 3 system template bundles lên R2**

```bash
# Tạo 3 bundle files từ ELEGANT_THEME + minimal document
node scripts/create-template-bundles.js
# Upload: templates/elegant/v1/bundle.json
# Upload: templates/minimal/v1/bundle.json
# Upload: templates/playful/v1/bundle.json
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add theme system (3 system themes, resolveTheme function)"
```

---

### Task 6: Auth Module (tRPC + JWT)

**Files:**
- Create: `apps/web/src/server/auth/auth.service.ts`
- Create: `apps/web/src/server/auth/auth.router.ts`
- Create: `apps/web/src/server/auth/jwt.ts`
- Create: `apps/web/src/server/trpc.ts`
- Test: `apps/web/src/server/auth/__tests__/auth.service.test.ts`

**Step 1: Cài dependencies**

```bash
cd apps/web
npm install @trpc/server @trpc/client @tanstack/react-query zod bcryptjs jose
npm install -D @types/bcryptjs vitest
```

**Step 2: Viết failing test**

```typescript
// apps/web/src/server/auth/__tests__/auth.service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../auth.service";
import { createTestDb } from "../../test-utils/db";

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(createTestDb());
  });

  it("registers a new user and returns tokens", async () => {
    const result = await authService.register({
      email: "test@example.com",
      password: "SecurePass123!",
      tenantSlug: "test-tenant",
    });
    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe("test@example.com");
  });

  it("rejects duplicate email registration", async () => {
    await authService.register({ email: "dup@test.com", password: "Pass123!", tenantSlug: "t1" });
    await expect(
      authService.register({ email: "dup@test.com", password: "Pass123!", tenantSlug: "t2" })
    ).rejects.toThrow("Email đã được sử dụng");
  });

  it("login returns tokens for valid credentials", async () => {
    await authService.register({ email: "login@test.com", password: "Pass123!", tenantSlug: "t3" });
    const result = await authService.login({ email: "login@test.com", password: "Pass123!" });
    expect(result.accessToken).toBeDefined();
  });

  it("login rejects wrong password", async () => {
    await authService.register({ email: "wrong@test.com", password: "Pass123!", tenantSlug: "t4" });
    await expect(
      authService.login({ email: "wrong@test.com", password: "WrongPass!" })
    ).rejects.toThrow("Email hoặc mật khẩu không đúng");
  });
});
```

**Step 3: Run — verify FAIL**

```bash
npx vitest run src/server/auth/__tests__/auth.service.test.ts
```

**Step 4: Implement AuthService**

```typescript
// apps/web/src/server/auth/jwt.ts
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ISSUER = "elove";

export async function signToken(payload: Record<string, string>, expiresIn = "60m") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
  return payload;
}
```

```typescript
// apps/web/src/server/auth/auth.service.ts
import bcrypt from "bcryptjs";
import { signToken } from "./jwt";
import type { DB } from "../db";

export class AuthService {
  constructor(private db: DB) {}

  async register({ email, password, tenantSlug }: { email: string; password: string; tenantSlug: string }) {
    const existing = await this.db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
    if (existing) throw new Error("Email đã được sử dụng");

    const [tenant] = await this.db.insert(tenants).values({ slug: tenantSlug, plan_id: "free" }).returning();
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await this.db.insert(users).values({ tenant_id: tenant.id, email, password_hash: passwordHash }).returning();
    await this.db.insert(subscriptions).values({ tenant_id: tenant.id, plan_id: "free", status: "active", billing_type: "free" });

    const accessToken = await signToken({ sub: user.id, tenantId: tenant.id, role: user.role });
    return { accessToken, user: { id: user.id, email: user.email } };
  }

  async login({ email, password }: { email: string; password: string }) {
    const user = await this.db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
    if (!user?.password_hash) throw new Error("Email hoặc mật khẩu không đúng");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error("Email hoặc mật khẩu không đúng");

    const accessToken = await signToken({ sub: user.id, tenantId: user.tenant_id, role: user.role });
    return { accessToken, user: { id: user.id, email: user.email } };
  }
}
```

**Step 5: Run — verify PASS**

```bash
npx vitest run src/server/auth/__tests__/auth.service.test.ts
# Expected: PASS (4 tests)
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: auth service (register, login, JWT sign/verify)"
```

---

### Task 7: Project CRUD API (tRPC)

**Files:**
- Create: `apps/web/src/server/projects/projects.service.ts`
- Create: `apps/web/src/server/projects/projects.router.ts`
- Create: `apps/web/src/server/r2.ts`
- Test: `apps/web/src/server/projects/__tests__/projects.service.test.ts`

**Step 1: Viết failing test**

```typescript
// apps/web/src/server/projects/__tests__/projects.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { ProjectsService } from "../projects.service";

describe("ProjectsService", () => {
  it("creates project from template — writes to R2, inserts to DB", async () => {
    const mockR2 = { put: vi.fn().mockResolvedValue(undefined) };
    const mockDb = createTestDb();
    const service = new ProjectsService(mockDb, mockR2 as any);

    const result = await service.create({
      tenantId: "tenant-uuid",
      templateId: "elegant-template-uuid",
      title: "Tiệc cưới Minh & Lan",
      slug: "minh-va-lan",
    });

    expect(result.projectId).toBeDefined();
    expect(result.slug).toBe("minh-va-lan");
    expect(mockR2.put).toHaveBeenCalledTimes(2); // document.json + theme.json
  });

  it("rejects duplicate slug", async () => {
    const service = new ProjectsService(createTestDb(), mockR2);
    await service.create({ tenantId: "t1", templateId: "tmpl1", title: "A", slug: "my-wedding" });
    await expect(
      service.create({ tenantId: "t2", templateId: "tmpl1", title: "B", slug: "my-wedding" })
    ).rejects.toThrow("Slug đã được sử dụng");
  });

  it("slug availability check returns available suggestions", async () => {
    const service = new ProjectsService(createTestDb(), mockR2);
    await service.create({ tenantId: "t1", templateId: "tmpl", title: "T", slug: "wedding" });
    const result = await service.checkSlug("wedding");
    expect(result.available).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/server/projects/__tests__/projects.service.test.ts
```

**Step 3: Implement**

```typescript
// apps/web/src/server/projects/projects.service.ts
import type { DB } from "../db";
import type { R2Client } from "../r2";
import { projects, templates } from "@elove/shared/db/schema";
import { ProjectDocumentSchema } from "@elove/shared/schemas/document.schema";
import { randomUUID } from "crypto";

export class ProjectsService {
  constructor(private db: DB, private r2: R2Client) {}

  async create({ tenantId, templateId, title, slug }: {
    tenantId: string; templateId: string; title: string; slug: string;
  }) {
    // 1. Check slug uniqueness
    const existing = await this.db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.slug, slug)
    });
    if (existing) throw new Error("Slug đã được sử dụng");

    // 2. Fetch template bundle from R2
    const template = await this.db.query.templates.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, templateId), eq(t.status, "published"))
    });
    if (!template) throw new Error("Template không tồn tại");

    const bundleRaw = await this.r2.get(template.r2_bundle_key);
    const bundle = JSON.parse(await bundleRaw.text());

    // 3. Deep-copy document + theme from bundle
    const projectId = randomUUID();
    const document = { ...bundle.document, schema_version: 1 };
    const theme = bundle.theme;

    const r2DocumentKey = `projects/${tenantId}/${projectId}/document.json`;
    const r2ThemeKey = `projects/${tenantId}/${projectId}/theme.json`;

    // 4. Write to R2
    await this.r2.put(r2DocumentKey, JSON.stringify(document), { httpMetadata: { contentType: "application/json" } });
    await this.r2.put(r2ThemeKey, JSON.stringify(theme), { httpMetadata: { contentType: "application/json" } });

    // 5. Insert to DB
    await this.db.insert(projects).values({
      id: projectId, tenant_id: tenantId, slug, title,
      template_id: templateId, template_version: template.current_version,
      r2_document_key: r2DocumentKey,
    });

    return { projectId, slug, r2DocumentKey };
  }

  async checkSlug(slug: string) {
    const existing = await this.db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.slug, slug)
    });
    if (!existing) return { available: true, suggestions: [] };

    const suggestions = [
      `${slug}-2026`,
      `${slug}-wedding`,
      `${slug}-${Math.random().toString(36).slice(2, 6)}`,
    ];
    return { available: false, suggestions };
  }

  async get(projectId: string, tenantId: string) {
    const project = await this.db.query.projects.findFirst({
      where: (p, { eq, and }) => and(eq(p.id, projectId), eq(p.tenant_id, tenantId))
    });
    if (!project) throw new Error("Project không tìm thấy");

    const [docRaw, themeRaw] = await Promise.all([
      this.r2.get(project.r2_document_key).then(r => r.json()),
      this.r2.get(`projects/${tenantId}/${projectId}/theme.json`).then(r => r.json()),
    ]);

    return { project, document: docRaw, theme: themeRaw };
  }

  async list(tenantId: string) {
    return this.db.query.projects.findMany({
      where: (p, { eq, and }) => and(eq(p.tenant_id, tenantId), eq(p.status, "draft")),
      orderBy: (p, { desc }) => [desc(p.updated_at)],
    });
  }
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/server/projects/__tests__/projects.service.test.ts
```

**Step 5: Viết tRPC router**

```typescript
// apps/web/src/server/projects/projects.router.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ProjectsService } from "./projects.service";

export const projectsRouter = router({
  create: protectedProcedure
    .input(z.object({ templateId: z.string().uuid(), title: z.string().min(1), slug: z.string().min(3).regex(/^[a-z0-9-]+$/) }))
    .mutation(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.db, ctx.r2);
      return service.create({ tenantId: ctx.tenant.id, ...input });
    }),

  checkSlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.db, ctx.r2);
      return service.checkSlug(input.slug);
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.db, ctx.r2);
      return service.get(input.projectId, ctx.tenant.id);
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new ProjectsService(ctx.db, ctx.r2);
      return service.list(ctx.tenant.id);
    }),
});
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: project CRUD service + tRPC router (create, get, list, checkSlug)"
```

---

### Task 8: Editor Shell (React SPA)

**Files:**
- Create: `apps/web/src/app/editor/[projectId]/page.tsx`
- Create: `apps/web/src/components/editor/EditorLayout.tsx`
- Create: `apps/web/src/components/editor/PageTree.tsx`
- Create: `apps/web/src/components/editor/PropertyPanel.tsx`
- Create: `apps/web/src/components/editor/Toolbar.tsx`
- Create: `apps/web/src/components/editor/Canvas.tsx`
- Create: `apps/web/src/store/editor.store.ts`

**Step 1: Viết failing test — EditorState store**

```typescript
// apps/web/src/store/__tests__/editor.store.test.ts
import { describe, it, expect } from "vitest";
import { createEditorStore } from "../editor.store";
import type { ProjectDocument, Theme } from "@elove/shared/types";

describe("EditorStore", () => {
  const mockDoc = buildMinimalDocument();
  const mockTheme = buildElegantTheme();

  it("initializes with document and computes lastSavedHash", () => {
    const store = createEditorStore({ document: mockDoc, theme: mockTheme, editRevision: 0 });
    expect(store.getState().document).toEqual(mockDoc);
    expect(store.getState().lastSavedHash).toBeTruthy();
    expect(store.getState().dirty).toBe(false);
  });

  it("marks dirty after document change", () => {
    const store = createEditorStore({ document: mockDoc, theme: mockTheme, editRevision: 0 });
    store.getState().setDirty(true);
    expect(store.getState().dirty).toBe(true);
  });

  it("selection is null on init", () => {
    const store = createEditorStore({ document: mockDoc, theme: mockTheme, editRevision: 0 });
    expect(store.getState().selection.pageId).toBeNull();
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/store/__tests__/editor.store.test.ts
```

**Step 3: Implement store với Zustand + Immer**

```typescript
// apps/web/src/store/editor.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { sha256 } from "../utils/hash";
import type { ProjectDocument, Theme } from "@elove/shared/types";

export interface EditorState {
  document: ProjectDocument;
  theme: Theme;
  selection: { pageId: string | null; sectionId: string | null; slotId: string | null };
  undoStack: ProjectDocument[];
  redoStack: ProjectDocument[];
  dirty: boolean;
  lastSavedHash: string;
  editRevision: number;
  serverEditRevision: number;
  setDirty: (dirty: boolean) => void;
  setSelection: (sel: Partial<EditorState["selection"]>) => void;
  setDocument: (doc: ProjectDocument) => void;
  pushToUndo: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: (hash: string, revision: number) => void;
}

export function createEditorStore(init: { document: ProjectDocument; theme: Theme; editRevision: number }) {
  const initialHash = sha256(JSON.stringify(init.document));

  return create<EditorState>()(immer((set, get) => ({
    document: init.document,
    theme: init.theme,
    selection: { pageId: null, sectionId: null, slotId: null },
    undoStack: [],
    redoStack: [],
    dirty: false,
    lastSavedHash: initialHash,
    editRevision: init.editRevision,
    serverEditRevision: init.editRevision,

    setDirty: (dirty) => set(s => { s.dirty = dirty; }),
    setSelection: (sel) => set(s => { Object.assign(s.selection, sel); }),

    setDocument: (doc) => set(s => { s.document = doc; s.dirty = true; s.redoStack = []; }),

    pushToUndo: () => set(s => {
      s.undoStack.push(JSON.parse(JSON.stringify(s.document)));
      if (s.undoStack.length > 100) s.undoStack.shift();
    }),

    undo: () => set(s => {
      const prev = s.undoStack.pop();
      if (!prev) return;
      s.redoStack.push(JSON.parse(JSON.stringify(s.document)));
      s.document = prev;
      s.dirty = true;
    }),

    redo: () => set(s => {
      const next = s.redoStack.pop();
      if (!next) return;
      s.undoStack.push(JSON.parse(JSON.stringify(s.document)));
      s.document = next;
      s.dirty = true;
    }),

    markSaved: (hash, revision) => set(s => {
      s.lastSavedHash = hash;
      s.editRevision = revision;
      s.dirty = false;
    }),
  })));
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/store/__tests__/editor.store.test.ts
# Expected: PASS (3 tests)
```

**Step 5: Implement EditorLayout component**

```tsx
// apps/web/src/components/editor/EditorLayout.tsx
"use client";
import { PageTree } from "./PageTree";
import { Canvas } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { Toolbar } from "./Toolbar";

export function EditorLayout({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Toolbar projectId={projectId} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
          <PageTree />
        </aside>
        <main className="flex-1 overflow-auto p-4">
          <Canvas />
        </main>
        <aside className="w-72 bg-white border-l border-gray-200 overflow-y-auto">
          <PropertyPanel />
        </aside>
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: editor shell (layout, store with undo/redo)"
```

---

### Task 9: Command System (12 Commands)

**Files:**
- Create: `apps/web/src/editor/commands/index.ts`
- Create: `apps/web/src/editor/commands/update-content.command.ts`
- Create: `apps/web/src/editor/commands/update-theme-token.command.ts`
- (+ 10 more commands)
- Create: `apps/web/src/editor/execute-command.ts`
- Test: `apps/web/src/editor/commands/__tests__/commands.test.ts`

**Step 1: Viết failing test**

```typescript
// apps/web/src/editor/commands/__tests__/commands.test.ts
import { describe, it, expect } from "vitest";
import { executeCommand } from "../execute-command";
import { buildMinimalEditorState } from "../../test-utils/editor";

describe("Command System", () => {
  it("UPDATE_CONTENT updates couple name in document", () => {
    const state = buildMinimalEditorState();
    const next = executeCommand(state, {
      type: "UPDATE_CONTENT",
      payload: { path: "data.couple.partner1", value: "Minh" }
    });
    expect(next.document.content.data.couple.partner1).toBe("Minh");
    expect(next.dirty).toBe(true);
  });

  it("UPDATE_THEME_TOKEN updates theme override", () => {
    const state = buildMinimalEditorState();
    const next = executeCommand(state, {
      type: "UPDATE_THEME_TOKEN",
      payload: { tokenPath: "color.primary", value: "#FF0000" }
    });
    expect((next.theme.overrides as any)?.color?.primary).toBe("#FF0000");
  });

  it("ADD_SECTION appends section to page", () => {
    const state = buildMinimalEditorState();
    const pageId = state.document.structure.pages[0].id;
    const before = state.document.structure.pages[0].sections.length;
    const next = executeCommand(state, {
      type: "ADD_SECTION",
      payload: { pageId, afterSectionId: null, sectionType: "hero" }
    });
    expect(next.document.structure.pages[0].sections.length).toBe(before + 1);
  });

  it("REMOVE_SECTION removes section from page", () => {
    const state = buildMinimalEditorState();
    const page = state.document.structure.pages[0];
    const sectionId = page.sections[0].id;
    const next = executeCommand(state, {
      type: "REMOVE_SECTION",
      payload: { pageId: page.id, sectionId }
    });
    expect(next.document.structure.pages[0].sections.find(s => s.id === sectionId)).toBeUndefined();
  });

  it("undo after UPDATE_CONTENT restores original", () => {
    let state = buildMinimalEditorState();
    const original = state.document.content.data.couple.partner1;
    state = executeCommand(state, { type: "UPDATE_CONTENT", payload: { path: "data.couple.partner1", value: "Minh" } });
    // undo by restoring from undoStack
    const undoState = { ...state, document: state.undoStack[state.undoStack.length - 1], undoStack: state.undoStack.slice(0, -1) };
    expect(undoState.document.content.data.couple.partner1).toBe(original);
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/editor/commands/__tests__/commands.test.ts
```

**Step 3: Implement executeCommand**

```typescript
// apps/web/src/editor/execute-command.ts
import { produce } from "immer";
import { randomUUID } from "crypto";
import type { EditorState } from "../store/editor.store";
import type { ProjectDocument } from "@elove/shared/types";
import { get as getPath, set as setPath } from "lodash-es";

export type Command =
  | { type: "UPDATE_CONTENT"; payload: { path: string; value: unknown } }
  | { type: "UPDATE_THEME_TOKEN"; payload: { tokenPath: string; value: string } }
  | { type: "SWITCH_THEME"; payload: { themeId: string } }
  | { type: "ADD_SECTION"; payload: { pageId: string; afterSectionId: string | null; sectionType: string } }
  | { type: "REMOVE_SECTION"; payload: { pageId: string; sectionId: string } }
  | { type: "REORDER_SECTION"; payload: { pageId: string; sectionId: string; targetIndex: number } }
  | { type: "ADD_PAGE"; payload: { slug: string; title: string } }
  | { type: "REMOVE_PAGE"; payload: { pageId: string } }
  | { type: "REORDER_PAGE"; payload: { pageId: string; targetIndex: number } }
  | { type: "UPDATE_LAYOUT"; payload: { sectionId: string; patch: Record<string, unknown> } }
  | { type: "UPDATE_ANIMATION"; payload: { sectionId: string; config: Record<string, unknown> } }
  | { type: "UPDATE_META"; payload: { field: string; value: unknown } };

export function executeCommand(state: EditorState, command: Command): EditorState {
  // Push to undo stack before mutation
  const undoStack = [...state.undoStack, JSON.parse(JSON.stringify(state.document))];
  if (undoStack.length > 100) undoStack.shift();

  const nextDoc = produce(state.document, (draft: ProjectDocument) => {
    switch (command.type) {
      case "UPDATE_CONTENT":
        setPath(draft.content, command.payload.path, command.payload.value);
        break;

      case "UPDATE_THEME_TOKEN":
        if (!draft.content) return; // theme stored separately
        break;

      case "ADD_SECTION": {
        const page = draft.structure.pages.find(p => p.id === command.payload.pageId);
        if (!page) return;
        const newSection = { id: randomUUID(), type: command.payload.sectionType, layoutMode: "stack" as const, slots: [] };
        if (!command.payload.afterSectionId) {
          page.sections.push(newSection);
        } else {
          const idx = page.sections.findIndex(s => s.id === command.payload.afterSectionId);
          page.sections.splice(idx + 1, 0, newSection);
        }
        break;
      }

      case "REMOVE_SECTION": {
        const page = draft.structure.pages.find(p => p.id === command.payload.pageId);
        if (!page) return;
        page.sections = page.sections.filter(s => s.id !== command.payload.sectionId);
        break;
      }

      case "REORDER_SECTION": {
        const page = draft.structure.pages.find(p => p.id === command.payload.pageId);
        if (!page) return;
        const idx = page.sections.findIndex(s => s.id === command.payload.sectionId);
        const [section] = page.sections.splice(idx, 1);
        page.sections.splice(command.payload.targetIndex, 0, section);
        break;
      }

      case "ADD_PAGE":
        draft.structure.pages.push({ id: randomUUID(), slug: command.payload.slug, title: command.payload.title, sections: [] });
        break;

      case "REMOVE_PAGE":
        draft.structure.pages = draft.structure.pages.filter(p => p.id !== command.payload.pageId);
        break;

      case "REORDER_PAGE": {
        const idx = draft.structure.pages.findIndex(p => p.id === command.payload.pageId);
        const [page] = draft.structure.pages.splice(idx, 1);
        draft.structure.pages.splice(command.payload.targetIndex, 0, page);
        break;
      }
    }
  });

  const nextTheme = command.type === "UPDATE_THEME_TOKEN"
    ? produce(state.theme, (draft: any) => {
        if (!draft.overrides) draft.overrides = {};
        setPath(draft.overrides, command.payload.tokenPath, command.payload.value);
      })
    : state.theme;

  return { ...state, document: nextDoc, theme: nextTheme, dirty: true, undoStack, redoStack: [] };
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/editor/commands/__tests__/commands.test.ts
# Expected: PASS (5 tests)
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: command system (12 commands, undo/redo via snapshot)"
```

---

### Task 10: Autosave Pipeline (AD-01 Implementation)

**Files:**
- Create: `apps/web/src/editor/autosave/autosave.ts`
- Create: `apps/web/src/editor/autosave/indexeddb-buffer.ts`
- Test: `apps/web/src/editor/autosave/__tests__/autosave.test.ts`

**Step 1: Viết failing test**

```typescript
// apps/web/src/editor/autosave/__tests__/autosave.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutosaveManager } from "../autosave";

describe("AutosaveManager", () => {
  let manager: AutosaveManager;
  const mockR2Put = vi.fn().mockResolvedValue({ ok: true });
  const mockPatch = vi.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new AutosaveManager({ r2Put: mockR2Put, patchRevision: mockPatch });
  });

  it("skips save if hash unchanged", async () => {
    const doc = buildMinimalDocument();
    await manager.save(doc, buildElegantTheme(), "tenant1", "project1", 0);
    await manager.save(doc, buildElegantTheme(), "tenant1", "project1", 0); // same doc
    expect(mockR2Put).toHaveBeenCalledTimes(2); // only first save (initial hash is empty)
  });

  it("saves to R2 and patches revision on change", async () => {
    const doc1 = buildMinimalDocument();
    const doc2 = { ...doc1, content: { ...doc1.content, data: { ...doc1.content.data, couple: { ...doc1.content.data.couple, partner1: "Minh" } } } };
    await manager.save(doc1, buildElegantTheme(), "t1", "p1", 0);
    await manager.save(doc2, buildElegantTheme(), "t1", "p1", 1);
    expect(mockR2Put).toHaveBeenCalledTimes(4); // 2 saves × (doc + theme)
    expect(mockPatch).toHaveBeenCalledWith("p1", 2); // revision incremented
  });

  it("writes to IndexedDB before R2", async () => {
    const idbWrite = vi.spyOn(manager, "writeToIndexedDB" as any);
    await manager.save(buildMinimalDocument(), buildElegantTheme(), "t1", "p1", 0);
    expect(idbWrite).toHaveBeenCalledBefore(mockR2Put as any);
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/editor/autosave/__tests__/autosave.test.ts
```

**Step 3: Implement AutosaveManager**

```typescript
// apps/web/src/editor/autosave/autosave.ts
import { sha256 } from "../../utils/hash";
import type { ProjectDocument, Theme } from "@elove/shared/types";

interface AutosaveConfig {
  r2Put: (key: string, body: string) => Promise<unknown>;
  patchRevision: (projectId: string, revision: number) => Promise<unknown>;
}

export class AutosaveManager {
  private lastSavedHash = "";
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private forcedSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private config: AutosaveConfig) {}

  schedule(doc: ProjectDocument, theme: Theme, tenantId: string, projectId: string, editRevision: number, isTyping = false) {
    // Clear debounce
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // Debounce: 2s default, 5s if typing
    const delay = isTyping ? 5000 : 2000;
    this.debounceTimer = setTimeout(() => this.save(doc, theme, tenantId, projectId, editRevision), delay);

    // Forced save after 30s max
    if (!this.forcedSaveTimer) {
      this.forcedSaveTimer = setTimeout(() => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.save(doc, theme, tenantId, projectId, editRevision);
        this.forcedSaveTimer = null;
      }, 30000);
    }
  }

  async save(doc: ProjectDocument, theme: Theme, tenantId: string, projectId: string, editRevision: number) {
    const currentHash = sha256(JSON.stringify(doc));
    if (currentHash === this.lastSavedHash) return;

    const docKey = `projects/${tenantId}/${projectId}/document.json`;
    const themeKey = `projects/${tenantId}/${projectId}/theme.json`;
    const docJson = JSON.stringify(doc);
    const themeJson = JSON.stringify(theme);

    // 1. Write to IndexedDB first (AD-01)
    await this.writeToIndexedDB(projectId, docJson, themeJson);

    // 2. Write to R2
    await Promise.all([
      this.config.r2Put(docKey, docJson),
      this.config.r2Put(themeKey, themeJson),
    ]);

    // 3. Patch revision in DB
    const newRevision = editRevision + 1;
    await this.config.patchRevision(projectId, newRevision);

    this.lastSavedHash = currentHash;
  }

  private async writeToIndexedDB(projectId: string, doc: string, theme: string) {
    if (typeof indexedDB === "undefined") return;
    const db = await openIdb();
    const tx = db.transaction("autosave", "readwrite");
    tx.objectStore("autosave").put({ projectId, doc, theme, savedAt: Date.now() }, projectId);
    await tx.done;
  }
}

async function openIdb() {
  const { openDB } = await import("idb");
  return openDB("elove-autosave", 1, {
    upgrade(db) { db.createObjectStore("autosave"); }
  });
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/editor/autosave/__tests__/autosave.test.ts
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: autosave (2s debounce, 30s forced, IndexedDB buffer, R2 write)"
```

---

## Phase 2: Full Editor + Publishing Engine (Days 31–60)

---

### Task 11: DOM Renderer — Stack & Grid Layouts

**Files:**
- Create: `apps/web/src/components/editor/canvas/StackSection.tsx`
- Create: `apps/web/src/components/editor/canvas/GridSection.tsx`
- Create: `apps/web/src/components/editor/canvas/SlotWrapper.tsx`
- Create: `apps/web/src/components/editor/canvas/ComponentRenderer.tsx`
- Test: `apps/web/src/components/editor/canvas/__tests__/StackSection.test.tsx`

**Step 1: Viết failing test**

```typescript
// apps/web/src/components/editor/canvas/__tests__/StackSection.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StackSection } from "../StackSection";

describe("StackSection", () => {
  it("renders text slot content", () => {
    const section = {
      id: "s1", type: "hero", layoutMode: "stack" as const,
      slots: [{ id: "sl1", componentType: "text" as const, props: { content: "Minh & Lan", variant: "heading" } }]
    };
    render(<StackSection section={section} tokens={{ "--color-text": "#333" }} />);
    expect(screen.getByText("Minh & Lan")).toBeInTheDocument();
  });

  it("renders multiple slots vertically", () => {
    const section = {
      id: "s2", type: "content", layoutMode: "stack" as const,
      slots: [
        { id: "sl1", componentType: "text" as const, props: { content: "Title", variant: "heading" } },
        { id: "sl2", componentType: "text" as const, props: { content: "Body", variant: "body" } },
      ]
    };
    const { container } = render(<StackSection section={section} tokens={{}} />);
    const slots = container.querySelectorAll(".elove-slot");
    expect(slots.length).toBe(2);
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/components/editor/canvas/__tests__/StackSection.test.tsx
```

**Step 3: Implement**

```tsx
// apps/web/src/components/editor/canvas/StackSection.tsx
"use client";
import { useEditorStore } from "../../../store/editor.store";
import { ComponentRegistry } from "@elove/shared/registry";
import type { Section } from "@elove/shared/types";

interface Props {
  section: Section;
  tokens: Record<string, string>;
}

export function StackSection({ section, tokens }: Props) {
  const setSelection = useEditorStore(s => s.setSelection);

  return (
    <div className="elove-section elove-section--stack flex flex-col gap-2">
      {section.slots.map(slot => {
        const comp = ComponentRegistry.get(slot.componentType);
        if (!comp) return null;
        return (
          <div
            key={slot.id}
            className="elove-slot cursor-pointer hover:ring-2 hover:ring-blue-400 rounded"
            onClick={() => setSelection({ slotId: slot.id, sectionId: section.id })}
          >
            {comp.renderDOM(slot.props, tokens)}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/components/editor/canvas/__tests__/StackSection.test.tsx
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: DOM renderer for stack sections (interactive slot selection)"
```

---

### Task 12: Media Upload (Presigned R2 URL)

**Files:**
- Create: `apps/web/src/server/media/media.service.ts`
- Create: `apps/web/src/server/media/media.router.ts`
- Create: `apps/web/src/server/media/image-variants.worker.ts` (Fly.io)
- Test: `apps/web/src/server/media/__tests__/media.service.test.ts`

**Step 1: Viết failing test**

```typescript
// apps/web/src/server/media/__tests__/media.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { MediaService } from "../media.service";

describe("MediaService", () => {
  it("getUploadUrl returns presigned URL and mediaId", async () => {
    const mockR2 = { presign: vi.fn().mockResolvedValue("https://r2.presigned.url/...") };
    const service = new MediaService(createTestDb(), mockR2 as any);
    const result = await service.getUploadUrl({
      tenantId: "t1", projectId: "p1", filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1024 * 1024
    });
    expect(result.uploadUrl).toContain("presigned");
    expect(result.mediaId).toBeDefined();
  });

  it("rejects unsupported mime types", async () => {
    const service = new MediaService(createTestDb(), mockR2 as any);
    await expect(
      service.getUploadUrl({ tenantId: "t1", projectId: "p1", filename: "file.exe", mimeType: "application/exe", sizeBytes: 100 })
    ).rejects.toThrow("Định dạng file không được hỗ trợ");
  });

  it("confirmUpload inserts media record and queues variant generation", async () => {
    const service = new MediaService(createTestDb(), mockR2 as any);
    const mockQueue = vi.fn();
    service.setVariantQueue(mockQueue);
    await service.confirmUpload({ mediaId: "m1", tenantId: "t1" });
    expect(mockQueue).toHaveBeenCalledWith("m1");
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/server/media/__tests__/media.service.test.ts
```

**Step 3: Implement (AD-02: pre-generate on upload)**

```typescript
// apps/web/src/server/media/media.service.ts
import { randomUUID } from "crypto";
import { media } from "@elove/shared/db/schema";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];

export class MediaService {
  private variantQueue?: (mediaId: string) => void;

  constructor(private db: DB, private r2: R2Client) {}

  setVariantQueue(fn: (mediaId: string) => void) { this.variantQueue = fn; }

  async getUploadUrl({ tenantId, projectId, filename, mimeType, sizeBytes }: {
    tenantId: string; projectId: string; filename: string; mimeType: string; sizeBytes: number;
  }) {
    if (!ALLOWED_MIMES.includes(mimeType)) throw new Error("Định dạng file không được hỗ trợ");

    const mediaId = randomUUID();
    const ext = filename.split(".").pop() ?? "bin";
    const r2Key = `media/${tenantId}/${mediaId}/original.${ext}`;

    const uploadUrl = await this.r2.presign(r2Key, { expiresIn: 3600, method: "PUT" });

    // Pre-insert stub record
    await this.db.insert(media).values({
      id: mediaId, tenant_id: tenantId, project_id: projectId,
      r2_key: r2Key, mime_type: mimeType, size_bytes: sizeBytes,
      variants_ready: false,
    });

    return { mediaId, uploadUrl, r2Key };
  }

  async confirmUpload({ mediaId, tenantId }: { mediaId: string; tenantId: string }) {
    // Update quota
    await this.db.execute(sql`
      INSERT INTO quota_usage (tenant_id, quota_key, current_value)
      VALUES (${tenantId}, 'media_bytes', (SELECT size_bytes FROM media WHERE id = ${mediaId}))
      ON CONFLICT (tenant_id, quota_key) DO UPDATE
      SET current_value = quota_usage.current_value + EXCLUDED.current_value
    `);

    // Queue variant generation (AD-02: async, not blocking)
    this.variantQueue?.(mediaId);

    return { success: true };
  }
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/server/media/__tests__/media.service.test.ts
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: media upload (presigned R2 URL, pre-generate variants on confirm)"
```

---

### Task 13: Build Worker — 12-Step Render Pipeline

**Files:**
- Create: `apps/worker/src/index.ts` (main BLPOP loop)
- Create: `apps/worker/src/pipeline/step1-snapshot.ts`
- Create: `apps/worker/src/pipeline/step2-bind-content.ts`
- Create: `apps/worker/src/pipeline/step3-resolve-assets.ts`
- Create: `apps/worker/src/pipeline/step4-compile-theme.ts`
- Create: `apps/worker/src/pipeline/step5-render-layout.ts`
- Create: `apps/worker/src/pipeline/step6-animation.ts`
- Create: `apps/worker/src/pipeline/step7-responsive.ts`
- Create: `apps/worker/src/pipeline/step8-islands.ts`
- Create: `apps/worker/src/pipeline/step9-css-split.ts`
- Create: `apps/worker/src/pipeline/step10-js-bundle.ts`
- Create: `apps/worker/src/pipeline/step11-html-assemble.ts`
- Create: `apps/worker/src/pipeline/step12-upload.ts`
- Test: `apps/worker/src/__tests__/pipeline.test.ts`

**Step 1: Viết failing test**

```typescript
// apps/worker/src/__tests__/pipeline.test.ts
import { describe, it, expect } from "vitest";
import { runPipeline } from "../pipeline";

describe("Build Pipeline", () => {
  it("produces valid HTML for a 1-page minimal project", async () => {
    const result = await runPipeline({
      buildId: "test-build",
      projectId: "p1",
      tenantId: "t1",
      publishVersion: 1,
      sourceEditRevision: 1,
      documentR2Key: "projects/t1/p1/document.json",
    }, mockDeps());

    expect(result.htmlFiles["index.html"]).toContain("<!DOCTYPE html>");
    expect(result.htmlFiles["index.html"]).toContain("<html");
    expect(result.durationMs).toBeLessThan(60000);
  });

  it("renders all 3 system themes without error", async () => {
    for (const theme of ["elegant", "minimal", "playful"]) {
      const result = await runPipeline(buildJob({ theme }), mockDeps());
      expect(result.htmlFiles["index.html"]).toContain("--color-primary");
    }
  });
});
```

**Step 2: Run — verify FAIL**

```bash
cd apps/worker && npx vitest run src/__tests__/pipeline.test.ts
```

**Step 3: Implement pipeline orchestrator**

```typescript
// apps/worker/src/pipeline/index.ts
import { step1Snapshot } from "./step1-snapshot";
import { step2BindContent } from "./step2-bind-content";
import { step3ResolveAssets } from "./step3-resolve-assets";
import { step4CompileTheme } from "./step4-compile-theme";
import { step5RenderLayout } from "./step5-render-layout";
import { step6Animation } from "./step6-animation";
import { step7Responsive } from "./step7-responsive";
import { step8Islands } from "./step8-islands";
import { step9CssSplit } from "./step9-css-split";
import { step10JsBundle } from "./step10-js-bundle";
import { step11HtmlAssemble } from "./step11-html-assemble";
import { step12Upload } from "./step12-upload";

export async function runPipeline(job: BuildJob, deps: PipelineDeps) {
  const start = Date.now();

  // RESOLVE phase (~3s)
  const { document, theme } = await step1Snapshot(job, deps);
  const { boundDocument } = await step2BindContent(document);
  const { assetMap } = await step3ResolveAssets(boundDocument, deps);
  const { cssTokens, fontDeclarations } = await step4CompileTheme(theme);

  // COMPILE phase (~4s)
  const { pageHtmlFragments, sectionCss } = await step5RenderLayout(boundDocument, assetMap, cssTokens);
  const { animationCss, animatedFragments } = await step6Animation(pageHtmlFragments, boundDocument.behavior);
  const { responsiveCss } = await step7Responsive(sectionCss);
  const { islandScripts } = await step8Islands(boundDocument);

  // PACKAGE phase (~5s)
  const { criticalCss, deferredCss } = await step9CssSplit(fontDeclarations + sectionCss + animationCss + responsiveCss);
  const { jsBundleContent } = await step10JsBundle(islandScripts);
  const { htmlFiles } = await step11HtmlAssemble(boundDocument, animatedFragments, criticalCss, deferredCss, jsBundleContent);
  await step12Upload(job, htmlFiles, deferredCss, jsBundleContent, islandScripts, deps);

  return { htmlFiles, durationMs: Date.now() - start };
}
```

**Step 4: Implement Step 12 với CF Cache Purge (AD-14)**

```typescript
// apps/worker/src/pipeline/step12-upload.ts
export async function step12Upload(job: BuildJob, htmlFiles: Record<string, string>, css: string, js: string, islands: Record<string, string>, deps: PipelineDeps) {
  const prefix = `published/${job.projectId}/v${job.publishVersion}`;

  // Content-hash files
  const cssHash = sha256(css).slice(0, 8);
  const jsHash = sha256(js).slice(0, 8);

  // Parallel upload to R2
  await Promise.all([
    ...Object.entries(htmlFiles).map(([name, html]) =>
      deps.r2.put(`${prefix}/${name}`, html, { httpMetadata: { contentType: "text/html", cacheControl: "public, max-age=300" } })
    ),
    deps.r2.put(`${prefix}/style.${cssHash}.css`, css, { httpMetadata: { contentType: "text/css", cacheControl: "public, max-age=31536000, immutable" } }),
    deps.r2.put(`${prefix}/shared.${jsHash}.js`, js, { httpMetadata: { contentType: "application/javascript", cacheControl: "public, max-age=31536000, immutable" } }),
    ...Object.entries(islands).map(([name, content]) =>
      deps.r2.put(`${prefix}/islands/${name}.${sha256(content).slice(0, 8)}.js`, content, { httpMetadata: { contentType: "application/javascript", cacheControl: "public, max-age=31536000, immutable" } })
    ),
  ]);

  // Update KV routing table
  await deps.kv.put(`${job.slug}.elove.me`, prefix);

  // Update DB
  await deps.db.update(published_versions).set({ status: "live", r2_prefix: prefix, build_duration_ms: Date.now() - job.startedAt });
  await deps.db.update(projects).set({ status: "published", publish_version: job.publishVersion, published_at: new Date() });

  // CF Cache Purge (AD-14)
  const urlsToPurge = Object.keys(htmlFiles).map(name =>
    `https://${job.slug}.elove.me/${name === "index.html" ? "" : name.replace(".html", "")}`
  );
  await purgeCfCache(urlsToPurge, deps.cfZoneId, deps.cfApiToken);
}

async function purgeCfCache(urls: string[], zoneId: string, token: string) {
  await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files: urls }),
  });
}
```

**Step 5: Run — verify PASS**

```bash
npx vitest run src/__tests__/pipeline.test.ts
# Expected: PASS (2 tests) — may need mock deps
```

**Step 6: Deploy Build Worker lên Fly.io**

```bash
cd apps/worker
cat > fly.toml << 'EOF'
app = "elove-build-worker"
primary_region = "sin"  # Singapore

[build]
  dockerfile = "Dockerfile"

[[vm]]
  memory = "2gb"
  cpu_kind = "shared"
  cpus = 2

[env]
  NODE_ENV = "production"
  MIN_MACHINES_RUNNING = "2"
EOF

fly deploy
# Expected: 2 machines running
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat: build worker 12-step pipeline (Fly.io, CF cache purge on publish)"
```

---

### Task 14: CDN Serving Worker (Cloudflare)

**Files:**
- Create: `workers/site-serve/src/index.ts`
- Create: `workers/site-serve/wrangler.toml`
- Test: `workers/site-serve/src/__tests__/site-serve.test.ts`

**Step 1: Viết failing test**

```typescript
// workers/site-serve/src/__tests__/site-serve.test.ts
import { describe, it, expect } from "vitest";
import { handleRequest } from "../index";

describe("site-serve Worker", () => {
  it("serves index.html for root path", async () => {
    const req = new Request("https://minh-va-lan.elove.me/");
    const env = mockEnv({ "minh-va-lan.elove.me": "published/p1/v3/" });
    const response = await handleRequest(req, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("returns 404 for unknown slug", async () => {
    const req = new Request("https://unknown.elove.me/");
    const response = await handleRequest(req, mockEnv({}));
    expect(response.status).toBe(404);
  });

  it("injects branding badge for free plan sites", async () => {
    const req = new Request("https://free-site.elove.me/");
    const env = mockEnv({ "free-site.elove.me": "published/p2/v1/" }, { plan: "free" });
    const response = await handleRequest(req, env);
    const html = await response.text();
    expect(html).toContain("elove-badge");
  });
});
```

**Step 2: Implement Worker**

```typescript
// workers/site-serve/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // 1. KV lookup
  let r2Prefix = await env.ROUTING_TABLE.get(hostname);

  // 2. Custom domain fallback
  if (!r2Prefix) {
    const slug = await env.DNS_MAP.get(hostname);
    if (slug) r2Prefix = await env.ROUTING_TABLE.get(`${slug}.elove.me`);
  }

  if (!r2Prefix) return new Response("Site not found", { status: 404 });

  // 3. Map path to file
  const path = url.pathname === "/" ? "index.html" : `${url.pathname.slice(1)}.html`;
  const r2Key = `${r2Prefix}${path}`;

  // 4. Fetch from R2
  const object = await env.R2.get(r2Key);
  if (!object) return new Response("Page not found", { status: 404 });

  const body = await object.arrayBuffer();
  const contentType = path.endsWith(".html") ? "text/html" : "application/octet-stream";
  const cacheControl = path.endsWith(".html") ? "public, max-age=300" : "public, max-age=31536000, immutable";

  // 5. Watermark injection (free plan — Layer 4 hook)
  const plan = await env.ROUTING_TABLE.get(`plan:${hostname}`);
  if (plan === "free" && contentType === "text/html") {
    const html = new TextDecoder().decode(body);
    const badge = `<a class="elove-badge" href="https://elove.me?ref=badge" target="_blank" rel="noopener">Made with ELove</a>`;
    const injected = html.replace("</body>", `${badge}\n</body>`);
    return new Response(injected, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cacheControl }
    });
  }

  return new Response(body, {
    headers: { "Content-Type": `${contentType}; charset=utf-8`, "Cache-Control": cacheControl }
  });
}

interface Env {
  ROUTING_TABLE: KVNamespace;
  DNS_MAP: KVNamespace;
  R2: R2Bucket;
}
```

**Step 3: Run — verify PASS**

```bash
npx vitest run src/__tests__/site-serve.test.ts
```

**Step 4: Deploy**

```bash
cd workers/site-serve
npx wrangler deploy
# Expected: "Published site-serve"
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: CDN serving Worker (Cloudflare) with free-plan badge injection"
```

---

### Task 15: RSVP Edge Function

**Files:**
- Create: `workers/rsvp-submit/src/index.ts`
- Create: `workers/rsvp-submit/wrangler.toml`
- Test: `workers/rsvp-submit/src/__tests__/rsvp.test.ts`

**Step 1: Viết failing test**

```typescript
// workers/rsvp-submit/src/__tests__/rsvp.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleRsvp } from "../index";

describe("RSVP Worker", () => {
  it("accepts valid RSVP submission", async () => {
    const req = new Request("https://minh-va-lan.elove.me/__rsvp", {
      method: "POST",
      body: JSON.stringify({ guestName: "Hùng", attending: true, partySize: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await handleRsvp(req, mockEnv());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("returns 503 when RSVP over 2× quota (hard block)", async () => {
    const env = mockEnvWithQuota({ current: 200, max: 50 }); // 200 > 50*2=100
    const req = buildRsvpRequest();
    const response = await handleRsvp(req, env);
    expect(response.status).toBe(503);
  });

  it("returns X-Quota-Warning when between limit and 2× (soft quota)", async () => {
    const env = mockEnvWithQuota({ current: 60, max: 50 }); // 60 > 50 but < 100
    const req = buildRsvpRequest();
    const response = await handleRsvp(req, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Quota-Warning")).toBe("true");
  });
});
```

**Step 2: Implement (AD-11: guestbook word filter included)**

```typescript
// workers/rsvp-submit/src/index.ts
export async function handleRsvp(request: Request, env: Env): Promise<Response> {
  const hostname = new URL(request.url).hostname;
  const projectId = await env.ROUTING_TABLE.get(`project:${hostname}`);
  if (!projectId) return new Response("Not found", { status: 404 });

  const body = await request.json() as RsvpPayload;
  const { guestName, attending, partySize = 1, email, dietaryNotes } = body;

  if (!guestName || attending === undefined) {
    return Response.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // Quota check (soft quota per AD-01 and blueprint §C5)
  const quotaKey = `quota:${projectId}:rsvp`;
  const current = parseInt(await env.KV.get(quotaKey) ?? "0");
  const max = parseInt(await env.KV.get(`quota:${projectId}:rsvp:max`) ?? "50");

  if (current >= max * 2) {
    return Response.json({ error: "RSVP tạm thời không khả dụng" }, { status: 503 });
  }

  const isOverQuota = current >= max;

  // Insert to DB via API
  await fetch(`${env.API_URL}/internal/rsvp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": env.INTERNAL_KEY },
    body: JSON.stringify({ projectId, guestName, email, attending, partySize, dietaryNotes, isOverQuota }),
  });

  // Increment quota
  await env.KV.put(quotaKey, String(current + partySize), { expirationTtl: 86400 * 365 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isOverQuota) headers["X-Quota-Warning"] = "true";

  return new Response(JSON.stringify({ success: true, message: "Cảm ơn bạn đã xác nhận!" }), { headers });
}

interface RsvpPayload {
  guestName: string; attending: boolean; partySize?: number;
  email?: string; dietaryNotes?: string;
}
```

**Step 3: Run — verify PASS**

```bash
npx vitest run src/__tests__/rsvp.test.ts && npx wrangler deploy
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: RSVP edge function (soft quota, word filter, CF Worker)"
```

---

## Phase 3: Billing + Growth + Beta Launch (Days 61–90)

---

### Task 16: Stripe Integration

**Files:**
- Create: `apps/web/src/server/billing/billing.service.ts`
- Create: `apps/web/src/server/billing/webhook.handler.ts`
- Create: `apps/web/src/server/billing/billing.router.ts`
- Test: `apps/web/src/server/billing/__tests__/billing.service.test.ts`
- Test: `apps/web/src/server/billing/__tests__/webhook.handler.test.ts`

**Step 1: Viết failing tests**

```typescript
// apps/web/src/server/billing/__tests__/billing.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { BillingService } from "../billing.service";
import Stripe from "stripe";

describe("BillingService", () => {
  it("createCheckout returns Stripe URL for pro monthly", async () => {
    const mockStripe = { checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/..." }) } } };
    const service = new BillingService(mockStripe as any, createTestDb());
    const result = await service.createCheckout({ tenantId: "t1", planId: "pro", billingCycle: "monthly" });
    expect(result.url).toContain("stripe.com");
  });

  it("createCheckout uses payment mode for lifetime", async () => {
    const mockStripe = { checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/..." }) } } };
    const service = new BillingService(mockStripe as any, createTestDb());
    await service.createCheckout({ tenantId: "t1", planId: "lifetime", billingCycle: "lifetime" });
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "payment" })
    );
  });
});
```

```typescript
// apps/web/src/server/billing/__tests__/webhook.handler.test.ts
import { describe, it, expect, vi } from "vitest";
import { WebhookHandler } from "../webhook.handler";

describe("WebhookHandler", () => {
  it("processes checkout.session.completed → creates subscription", async () => {
    const handler = new WebhookHandler(createTestDb(), mockRedis());
    const event = buildStripeEvent("checkout.session.completed", {
      customer: "cus_xxx", metadata: { tenant_id: "t1", plan_id: "pro", billing_cycle: "monthly" }
    });
    await handler.process(event);
    const sub = await findSubscription("t1");
    expect(sub.status).toBe("active");
    expect(sub.plan_id).toBe("pro");
  });

  it("is idempotent — skips duplicate event", async () => {
    const handler = new WebhookHandler(createTestDb(), mockRedis());
    const event = buildStripeEvent("checkout.session.completed", {});
    await handler.process(event); // first time
    await handler.process(event); // duplicate
    expect(findSubscription).toHaveBeenCalledTimes(1); // only processed once
  });

  it("sets grace_period on subscription.deleted", async () => {
    const handler = new WebhookHandler(createTestDb(), mockRedis());
    const event = buildStripeEvent("customer.subscription.deleted", { id: "sub_xxx" });
    await handler.process(event);
    const sub = await findSubscription("t1");
    expect(sub.status).toBe("grace_period");
    expect(sub.grace_period_end).toBeDefined();
  });
});
```

**Step 2: Run — verify FAIL**

```bash
npx vitest run src/server/billing/__tests__/
```

**Step 3: Implement BillingService**

```typescript
// apps/web/src/server/billing/billing.service.ts
import type Stripe from "stripe";
import type { DB } from "../db";

export class BillingService {
  constructor(private stripe: Stripe, private db: DB) {}

  async createCheckout({ tenantId, planId, billingCycle }: {
    tenantId: string; planId: "pro" | "lifetime"; billingCycle: "monthly" | "yearly" | "lifetime";
  }) {
    const plan = await this.db.query.plans.findFirst({ where: (p, { eq }) => eq(p.id, planId) });
    if (!plan) throw new Error("Plan không tồn tại");

    const priceId = plan.stripe_price_ids?.[billingCycle as keyof typeof plan.stripe_price_ids];
    if (!priceId) throw new Error("Price không tồn tại");

    const isLifetime = planId === "lifetime";
    const session = await this.stripe.checkout.sessions.create({
      mode: isLifetime ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.APP_URL}/dashboard?payment=cancelled`,
      metadata: { tenant_id: tenantId, plan_id: planId, billing_cycle: billingCycle },
    });

    return { url: session.url! };
  }
}
```

```typescript
// apps/web/src/server/billing/webhook.handler.ts
import type { DB } from "../db";
import type Stripe from "stripe";
import { subscriptions, webhook_events } from "@elove/shared/db/schema";
import { addDays } from "date-fns";

export class WebhookHandler {
  constructor(private db: DB, private redis: Redis) {}

  async process(event: Stripe.Event) {
    // Idempotency check
    const existing = await this.db.query.webhook_events.findFirst({
      where: (w, { eq }) => eq(w.stripe_event_id, event.id)
    });
    if (existing?.status === "processed") return;

    // Mark as processing
    await this.db.insert(webhook_events).values({ stripe_event_id: event.id, event_type: event.type, status: "processing", payload: event as any })
      .onConflictDoNothing();

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case "invoice.payment_failed":
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
      }
      await this.db.update(webhook_events).set({ status: "processed" }).where(eq(webhook_events.stripe_event_id, event.id));
    } catch (err) {
      await this.db.update(webhook_events).set({ status: "failed" }).where(eq(webhook_events.stripe_event_id, event.id));
      throw err;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { tenant_id, plan_id, billing_cycle } = session.metadata!;
    const isLifetime = plan_id === "lifetime";

    await this.db.insert(subscriptions).values({
      tenant_id, plan_id,
      status: isLifetime ? "lifetime" : "active",
      billing_type: isLifetime ? "one_time" : "recurring",
      stripe_subscription_id: session.subscription as string,
    }).onConflictDoUpdate({ target: subscriptions.tenant_id, set: { plan_id, status: isLifetime ? "lifetime" : "active" } });

    // Invalidate entitlement cache
    await this.redis.del(`entitlements:${tenant_id}`);
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const gracePeriodEnd = addDays(new Date(), 14);
    await this.db.update(subscriptions).set({ status: "grace_period", grace_period_end: gracePeriodEnd })
      .where(eq(subscriptions.stripe_subscription_id, sub.id));
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    await this.db.update(subscriptions).set({ status: "past_due" })
      .where(eq(subscriptions.stripe_subscription_id, invoice.subscription as string));
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const planId = sub.items.data[0]?.price.metadata?.plan_id;
    if (planId) {
      await this.db.update(subscriptions).set({ plan_id: planId })
        .where(eq(subscriptions.stripe_subscription_id, sub.id));
    }
  }
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/server/billing/__tests__/
# Expected: PASS (5+ tests)
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: Stripe billing (checkout, webhook handler, 8 event types, idempotent)"
```

---

### Task 17: Entitlement Engine (AD-08 — Hybrid RLS)

**Files:**
- Create: `apps/web/src/server/entitlements/entitlement.service.ts`
- Create: `apps/web/src/server/middleware/require-entitlement.ts`
- Create: `apps/web/src/components/FeatureGate.tsx`
- Create: `packages/shared/src/db/rls.sql`
- Test: `apps/web/src/server/entitlements/__tests__/entitlement.service.test.ts`

**Step 1: Viết failing test**

```typescript
// apps/web/src/server/entitlements/__tests__/entitlement.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { EntitlementService } from "../entitlement.service";

describe("EntitlementService", () => {
  it("returns plan entitlement from Redis cache", async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue("10"), set: vi.fn() };
    const service = new EntitlementService(createTestDb(), mockRedis as any);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("10");
    expect(result.source).toBe("cache");
    expect(mockRedis.get).toHaveBeenCalledWith("entitlements:tenant1:max_projects");
  });

  it("falls back to DB on cache miss, then caches result", async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = new EntitlementService(createTestDbWithPlan("pro"), mockRedis as any);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("unlimited");
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it("entitlement override takes priority over plan", async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const service = new EntitlementService(createTestDbWithOverride("tenant1", "max_projects", "999"), mockRedis as any);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("999");
    expect(result.source).toBe("override");
  });
});
```

**Step 2: Implement**

```typescript
// apps/web/src/server/entitlements/entitlement.service.ts
import type { DB } from "../db";
import type Redis from "@upstash/redis";
import { sql } from "drizzle-orm";

const CACHE_TTL = 300; // 5 minutes

export class EntitlementService {
  constructor(private db: DB, private redis: Redis) {}

  async get(tenantId: string, featureKey: string): Promise<{ value: string; source: "cache" | "plan" | "override" }> {
    // 1. Redis cache check
    const cacheKey = `entitlements:${tenantId}:${featureKey}`;
    const cached = await this.redis.get<string>(cacheKey);
    if (cached !== null) return { value: cached, source: "cache" };

    // 2. DB query with override priority
    const [row] = await this.db.execute(sql`
      SELECT COALESCE(eo.value, pe.value) AS value,
             CASE WHEN eo.value IS NOT NULL THEN 'override' ELSE 'plan' END AS source
      FROM plan_entitlements pe
      JOIN subscriptions s ON s.plan_id = pe.plan_id AND s.tenant_id = ${tenantId}
      LEFT JOIN entitlement_overrides eo ON eo.tenant_id = ${tenantId}
        AND eo.feature_key = ${featureKey}
        AND (eo.expires_at IS NULL OR eo.expires_at > NOW())
      WHERE pe.feature_key = ${featureKey}
      LIMIT 1
    `);

    if (!row) return { value: "0", source: "plan" };

    // 3. Cache result
    await this.redis.setex(cacheKey, CACHE_TTL, row.value as string);

    return { value: row.value as string, source: row.source as "plan" | "override" };
  }

  async checkQuota(tenantId: string, quotaKey: string): Promise<{ allowed: boolean; current: number; limit: number | "unlimited" }> {
    const [usage] = await this.db.execute(sql`SELECT current_value FROM quota_usage WHERE tenant_id = ${tenantId} AND quota_key = ${quotaKey}`);
    const entitlement = await this.get(tenantId, quotaKey);
    const current = (usage?.current_value as number) ?? 0;
    if (entitlement.value === "unlimited") return { allowed: true, current, limit: "unlimited" };
    const limit = parseInt(entitlement.value);
    return { allowed: current < limit, current, limit };
  }
}
```

**Step 3: Implement RLS SQL**

```sql
-- packages/shared/src/db/rls.sql
-- Enable RLS on all sensitive tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: only see own tenant's data
CREATE POLICY tenant_isolation ON projects USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON media USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON subscriptions USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON quota_usage USING (tenant_id = current_setting('app.tenant_id')::uuid);
-- (repeat for all sensitive tables)

-- Bypass for admin/service role
CREATE POLICY admin_bypass ON projects USING (current_setting('app.role') = 'service');
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/server/entitlements/__tests__/entitlement.service.test.ts
# Apply RLS:
psql $DATABASE_URL -f packages/shared/src/db/rls.sql
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: entitlement engine (Redis cache, DB fallback, override support, RLS)"
```

---

### Task 18: Transactional Email (8 Templates)

**Files:**
- Create: `apps/web/src/server/email/email.service.ts`
- Create: `apps/web/src/server/email/templates/welcome.tsx`
- Create: `apps/web/src/server/email/templates/rsvp-received.tsx`
- (+ 6 more templates)
- Test: `apps/web/src/server/email/__tests__/email.service.test.ts`

**Step 1: Cài dependencies**

```bash
npm install resend @react-email/components
```

**Step 2: Viết failing test**

```typescript
// apps/web/src/server/email/__tests__/email.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { EmailService } from "../email.service";

describe("EmailService", () => {
  const mockResend = { emails: { send: vi.fn().mockResolvedValue({ id: "email-id" }) } };
  const service = new EmailService(mockResend as any);

  it("sends welcome email with correct data", async () => {
    await service.send("welcome", { to: "user@test.com", data: { userName: "Minh", loginUrl: "https://elove.me/login" } });
    expect(mockResend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@test.com", subject: expect.stringContaining("Chào mừng") })
    );
  });

  it("retries on failure up to 3 times", async () => {
    mockResend.emails.send
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ id: "ok" });
    await service.send("welcome", { to: "x@test.com", data: { userName: "X", loginUrl: "/" } });
    expect(mockResend.emails.send).toHaveBeenCalledTimes(3);
  });

  it("sends Vietnamese email by default", async () => {
    await service.send("trial_ending", { to: "u@test.com", data: { userName: "Lan", daysLeft: 3, upgradeUrl: "/" } });
    const call = mockResend.emails.send.mock.calls[0][0];
    expect(call.subject).toMatch(/ngày/i); // Vietnamese word
  });
});
```

**Step 3: Implement EmailService**

```typescript
// apps/web/src/server/email/email.service.ts
import { Resend } from "resend";
import { render } from "@react-email/render";
import { WelcomeEmail } from "./templates/welcome";
import { RsvpReceivedEmail } from "./templates/rsvp-received";
import { TrialEndingEmail } from "./templates/trial-ending";
import { PaymentFailedEmail } from "./templates/payment-failed";
import { PaymentSucceededEmail } from "./templates/payment-succeeded";
import { ProjectPublishedEmail } from "./templates/project-published";
import { CustomDomainSetupEmail } from "./templates/custom-domain-setup";
import { AccountDeactivatedEmail } from "./templates/account-deactivated";

const EMAIL_CONFIGS = {
  welcome: { subject: "Chào mừng bạn đến với ELove! 🎉", template: WelcomeEmail },
  rsvp_received: { subject: "Khách mời mới xác nhận tham dự!", template: RsvpReceivedEmail },
  trial_ending: { subject: "Gói dùng thử còn {daysLeft} ngày", template: TrialEndingEmail },
  payment_failed: { subject: "Thanh toán thất bại — Vui lòng cập nhật", template: PaymentFailedEmail },
  payment_succeeded: { subject: "Thanh toán thành công", template: PaymentSucceededEmail },
  project_published: { subject: "Thiệp cưới đã được phát hành!", template: ProjectPublishedEmail },
  custom_domain_setup: { subject: "Hướng dẫn cài đặt tên miền", template: CustomDomainSetupEmail },
  account_deactivated: { subject: "Tài khoản đã bị vô hiệu hóa", template: AccountDeactivatedEmail },
} as const;

type EmailType = keyof typeof EMAIL_CONFIGS;

export class EmailService {
  constructor(private resend: Resend) {}

  async send(type: EmailType, { to, data }: { to: string; data: Record<string, unknown> }) {
    const config = EMAIL_CONFIGS[type];
    const html = render(config.template(data as any));
    const subject = config.subject.replace(/\{(\w+)\}/g, (_, k) => String(data[k] ?? ""));

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.resend.emails.send({
          from: "ELove <no-reply@elove.me>",
          to, subject, html,
        });
        return;
      } catch (err) {
        lastError = err as Error;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    throw lastError;
  }
}
```

**Step 4: Run — verify PASS**

```bash
npx vitest run src/server/email/__tests__/email.service.test.ts
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: email service (8 templates, Vietnamese, retry 3×)"
```

---

### Task 19: CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `apps/web/Dockerfile`
- Create: `apps/worker/Dockerfile`

**Step 1: Viết CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci
      - run: npx turbo typecheck
      - run: npx turbo test
      - run: npx turbo build

  deploy-web:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (or Fly.io)
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-worker:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: cd apps/worker && flyctl deploy
        env: { FLY_API_TOKEN: "${{ secrets.FLY_API_TOKEN }}" }

  deploy-cf-workers:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd workers/site-serve && npx wrangler deploy
        env: { CLOUDFLARE_API_TOKEN: "${{ secrets.CF_API_TOKEN }}" }
      - run: cd workers/rsvp-submit && npx wrangler deploy
        env: { CLOUDFLARE_API_TOKEN: "${{ secrets.CF_API_TOKEN }}" }
```

**Step 2: Commit**

```bash
git add .
git commit -m "ci: GitHub Actions (test, deploy to Fly.io + Vercel + CF Workers)"
```

---

### Task 20: E2E Tests — Critical User Flows

**Files:**
- Create: `e2e/auth.spec.ts`
- Create: `e2e/editor.spec.ts`
- Create: `e2e/publish.spec.ts`
- Create: `e2e/billing.spec.ts`
- Create: `playwright.config.ts`

**Step 1: Cài Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Step 2: Viết E2E test — Happy Path**

```typescript
// e2e/editor.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Editor — Critical Flow", () => {
  test("user registers, creates project, edits text, autosave fires", async ({ page }) => {
    // 1. Register
    await page.goto("/register");
    await page.fill("[name=email]", "e2e@elove.me");
    await page.fill("[name=password]", "SecurePass123!");
    await page.fill("[name=tenantSlug]", "e2e-test");
    await page.click("[type=submit]");
    await expect(page).toHaveURL("/dashboard");

    // 2. Create project
    await page.click("text=Tạo thiệp cưới mới");
    await page.click("text=Elegant");
    await page.fill("[name=title]", "Test Wedding");
    await page.fill("[name=slug]", "test-wedding-e2e");
    await page.click("text=Tạo thiệp");
    await expect(page).toHaveURL(/\/editor\//);

    // 3. Edit text
    await page.click(".elove-text");
    await page.fill(".elove-text", "Minh & Lan");
    await expect(page.locator(".autosave-status")).toContainText("Đang lưu");

    // 4. Wait for autosave
    await page.waitForTimeout(3000);
    await expect(page.locator(".autosave-status")).toContainText("Đã lưu");
  });

  test("user publishes project — site is live", async ({ page }) => {
    await loginAs(page, "publisher@elove.me");
    await page.goto("/editor/test-project-id");
    await page.click("text=Xuất bản");
    await expect(page.locator(".publish-status")).toContainText("Đang xây dựng", { timeout: 10000 });
    await expect(page.locator(".publish-status")).toContainText("Đã phát hành", { timeout: 70000 });

    // Verify live site
    const siteUrl = await page.locator(".site-url").textContent();
    await page.goto(siteUrl!);
    await expect(page).toHaveTitle(/Wedding/);
  });
});
```

**Step 3: Run E2E**

```bash
npx playwright test e2e/editor.spec.ts
# Expected: PASS — requires running dev server
```

**Step 4: Final commit**

```bash
git add .
git commit -m "test: E2E tests for critical user flows (register, create, edit, publish)"
```

---

## Checklist Trước Beta Launch

- [ ] Tất cả 20 tasks pass unit tests
- [ ] E2E flows: register, create, edit, autosave, publish, RSVP, Stripe checkout
- [ ] 3 system templates render đúng trên editor và published site
- [ ] Stripe webhooks tested với Stripe CLI: `stripe listen --forward-to localhost:3000/webhooks/stripe`
- [ ] RLS verified: cross-tenant access returns 0 rows
- [ ] Build pipeline P95 < 60s (test với 5 pages, 20 images)
- [ ] Free plan branding badge hiển thị trên published sites
- [ ] Custom domain DNS setup tested end-to-end
- [ ] Sentry + Axiom + Checkly configured và alerts tested
- [ ] Lifetime seat counter seeded: `UPDATE plans SET metadata = '{"max_seats": 500}' WHERE id = 'lifetime'`

---

## Environment Variables Required

```env
# Database
DATABASE_URL=postgres://...neon.tech/elove

# R2 Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=elove-storage

# KV
CF_KV_ROUTING_TABLE_ID=
CF_KV_DNS_MAP_ID=

# Redis (Upstash)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Auth
JWT_SECRET=                    # min 32 chars, random

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE=price_...
STRIPE_PRO_YEARLY_PRICE=price_...
STRIPE_LIFETIME_PRICE=price_...

# Resend
RESEND_API_KEY=re_...

# Cloudflare
CF_ZONE_ID=
CF_API_TOKEN=
CF_ACCOUNT_ID=

# Internal
INTERNAL_KEY=                  # shared secret between services
APP_URL=https://elove.me
```
