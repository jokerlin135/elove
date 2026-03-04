import { describe, it, expect } from "vitest";

// Import after schema is created
import {
  tenants,
  users,
  plans,
  plan_entitlements,
  subscriptions,
  templates,
  projects,
  published_versions,
  media,
  rsvp_responses,
  guestbook_entries,
  quota_usage,
  custom_domains,
  webhook_events,
  billing_events,
  entitlement_overrides,
  build_jobs,
  editor_locks,
} from "../schema";

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

  it("build_jobs table exists (replaces Redis queue)", () => {
    expect(build_jobs.id).toBeDefined();
    expect(build_jobs.project_id).toBeDefined();
    expect(build_jobs.status).toBeDefined();
    expect(build_jobs.queued_at).toBeDefined();
  });

  it("editor_locks table exists (replaces Redis SET EX)", () => {
    expect(editor_locks.project_id).toBeDefined();
    expect(editor_locks.tab_id).toBeDefined();
    expect(editor_locks.expires_at).toBeDefined();
  });

  it("webhook_events has idempotency key", () => {
    expect(webhook_events.event_id).toBeDefined(); // idempotency key (was stripe_event_id)
  });

  it("all 18 tables are exported", () => {
    const tables = [
      tenants,
      users,
      plans,
      plan_entitlements,
      subscriptions,
      templates,
      projects,
      published_versions,
      media,
      rsvp_responses,
      guestbook_entries,
      quota_usage,
      custom_domains,
      webhook_events,
      billing_events,
      entitlement_overrides,
      build_jobs,
      editor_locks,
    ];
    expect(tables).toHaveLength(18);
    tables.forEach((t) => expect(t).toBeDefined());
  });
});
