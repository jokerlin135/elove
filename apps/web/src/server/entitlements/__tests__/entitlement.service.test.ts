import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EntitlementService,
  clearEntitlementCache,
} from "../entitlement.service";

function createMockSupa() {
  return {
    findFirst: vi.fn().mockResolvedValue(null as any),
    findMany: vi.fn().mockResolvedValue([] as any),
    insert: vi.fn().mockResolvedValue(undefined),
    insertIgnore: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

describe("EntitlementService", () => {
  beforeEach(() => {
    clearEntitlementCache();
  });

  it("returns plan entitlement from DB", async () => {
    const supa = createMockSupa();
    // No override
    supa.findFirst
      .mockResolvedValueOnce(null) // override → none
      .mockResolvedValueOnce({ plan_id: "pro" }) // subscription
      .mockResolvedValueOnce({ value: "unlimited" }); // plan_entitlement

    const service = new EntitlementService(supa as any);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("unlimited");
    expect(result.source).toBe("plan");
  });

  it("override takes priority over plan", async () => {
    const supa = createMockSupa();
    // Override exists
    supa.findFirst.mockResolvedValueOnce({ value: "999", expires_at: null });

    const service = new EntitlementService(supa as any);
    const result = await service.get("tenant1", "max_projects");
    expect(result.value).toBe("999");
    expect(result.source).toBe("override");
  });

  it("checkQuota returns allowed true for unlimited plan", async () => {
    const supa = createMockSupa();
    supa.findFirst
      .mockResolvedValueOnce(null) // no override
      .mockResolvedValueOnce({ plan_id: "pro" }) // subscription
      .mockResolvedValueOnce({ value: "unlimited" }); // plan_entitlement

    const service = new EntitlementService(supa as any);
    const result = await service.checkQuota("tenant1", "max_projects", 3);
    expect(result.allowed).toBe(true);
  });

  it("checkQuota returns allowed false when over limit", async () => {
    const supa = createMockSupa();
    supa.findFirst
      .mockResolvedValueOnce(null) // no override
      .mockResolvedValueOnce({ plan_id: "free" }) // subscription
      .mockResolvedValueOnce({ value: "1" }); // plan_entitlement

    const service = new EntitlementService(supa as any);
    const result = await service.checkQuota("tenant1", "max_projects", 2);
    expect(result.allowed).toBe(false);
  });
});
