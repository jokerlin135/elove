import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EntitlementService,
  clearEntitlementCache,
} from "../entitlement.service";

function createTestDbWithPlan(
  _planId: string,
  _featureKey: string,
  value: string,
) {
  return {
    execute: vi.fn().mockResolvedValue([{ value, source: "plan" }]),
  } as any;
}

function createTestDbWithOverride(
  _tenantId: string,
  _featureKey: string,
  value: string,
) {
  return {
    execute: vi.fn().mockResolvedValue([{ value, source: "override" }]),
  } as any;
}

describe("EntitlementService", () => {
  beforeEach(() => {
    clearEntitlementCache();
  });

  it("returns plan entitlement from DB", async () => {
    const db = createTestDbWithPlan("pro", "max_projects", "unlimited");
    const service = new EntitlementService(db);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("unlimited");
    expect(["plan", "override"]).toContain(result.source);
  });

  it("override takes priority over plan", async () => {
    const db = createTestDbWithOverride("tenant1", "max_projects", "999");
    const service = new EntitlementService(db);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("999");
    expect(result.source).toBe("override");
  });

  it("checkQuota returns allowed true for unlimited plan", async () => {
    const db = createTestDbWithPlan("pro", "max_projects", "unlimited");
    const service = new EntitlementService(db);
    const result = await service.checkQuota("tenant1", "max_projects", 3);
    expect(result.allowed).toBe(true);
  });

  it("checkQuota returns allowed false when over limit", async () => {
    const db = createTestDbWithPlan("free", "max_projects", "1");
    const service = new EntitlementService(db);
    const result = await service.checkQuota("tenant1", "max_projects", 2);
    expect(result.allowed).toBe(false);
  });
});
