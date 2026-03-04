import {
  pgTable, text, integer, boolean, timestamp,
  uuid, jsonb, index
} from "drizzle-orm/pg-core";

// ============ TENANTS + USERS ============

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  plan_id: text("plan_id").notNull().default("free"),
  payos_customer_id: text("payos_customer_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // matches auth.users.id from Supabase Auth
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("owner"), // owner | admin
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("users_tenant_idx").on(t.tenant_id)]);

// ============ PLANS ============

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // 'free' | 'pro' | 'lifetime'
  name: text("name").notNull(),
  payos_price_refs: jsonb("payos_price_refs").$type<{
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

// ============ SUBSCRIPTIONS ============

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id).unique(),
  plan_id: text("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull(), // active | past_due | canceled | trialing | lifetime | grace_period
  billing_type: text("billing_type").notNull(),
  payos_order_code: text("payos_order_code"),
  current_period_start: timestamp("current_period_start"),
  current_period_end: timestamp("current_period_end"),
  trial_end: timestamp("trial_end"),
  grace_period_end: timestamp("grace_period_end"),
  referral_code: text("referral_code"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============ TEMPLATES ============

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  current_version: integer("current_version").notNull().default(1),
  r2_bundle_key: text("r2_bundle_key").notNull(), // e.g. elove/templates/{id}/v1/bundle.json
  plan_required: text("plan_required").notNull().default("free"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============ PROJECTS ============

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  template_id: uuid("template_id").references(() => templates.id),
  template_version: integer("template_version"),
  r2_document_key: text("r2_document_key").notNull(), // e.g. elove/projects/{id}/document.json
  edit_revision: integer("edit_revision").notNull().default(0),
  publish_version: integer("publish_version").notNull().default(0),
  published_at: timestamp("published_at"),
  seo_meta: jsonb("seo_meta").$type<{ title: string; description: string; og_image?: string }>(),
  settings: jsonb("settings"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("projects_tenant_idx").on(t.tenant_id)]);

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

// ============ MEDIA ============

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  project_id: uuid("project_id").references(() => projects.id),
  r2_key: text("r2_key").notNull(), // e.g. elove/media/{id}/original.jpg
  mime_type: text("mime_type").notNull(),
  size_bytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  blurhash: text("blurhash"),
  variants_ready: boolean("variants_ready").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============ RSVP + GUESTBOOK ============

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
  is_approved: boolean("is_approved").notNull().default(true), // auto-approve + word filter
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============ QUOTA ============

export const quota_usage = pgTable("quota_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  quota_key: text("quota_key").notNull(), // e.g. rsvp_count, media_bytes, publish_count_today
  current_value: integer("current_value").notNull().default(0),
  period_start: timestamp("period_start"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============ CUSTOM DOMAINS ============

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

// ============ WEBHOOKS + BILLING EVENTS ============

export const webhook_events = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  event_id: text("event_id").notNull().unique(), // idempotency key (PayOS or any payment provider)
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

// ============ ENTITLEMENT OVERRIDES ============

export const entitlement_overrides = pgTable("entitlement_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  feature_key: text("feature_key").notNull(),
  value: text("value").notNull(),
  expires_at: timestamp("expires_at"),
  created_by: text("created_by"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============ BUILD JOBS (replaces Redis queue) ============

export const build_jobs = pgTable("build_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  project_id: uuid("project_id").notNull().references(() => projects.id),
  tenant_id: uuid("tenant_id").notNull(),
  publish_version: integer("publish_version").notNull(),
  source_edit_revision: integer("source_edit_revision").notNull(),
  document_r2_key: text("document_r2_key").notNull(),
  status: text("status").notNull().default("queued"), // queued | processing | done | failed
  error_message: text("error_message"),
  queued_at: timestamp("queued_at").defaultNow().notNull(),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
});

// ============ EDITOR LOCKS (replaces Redis SET EX) ============

export const editor_locks = pgTable("editor_locks", {
  project_id: uuid("project_id").primaryKey().references(() => projects.id),
  tab_id: text("tab_id").notNull(),
  expires_at: timestamp("expires_at").notNull(),
});
