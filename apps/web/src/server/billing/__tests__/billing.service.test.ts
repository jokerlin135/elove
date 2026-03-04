import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "../billing.service";
import type { Db } from "@elove/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPayos(checkoutUrl = "https://pay.payos.vn/web/test-link") {
  return {
    paymentRequests: {
      create: vi.fn().mockResolvedValue({
        checkoutUrl,
        bin: "970436",
        accountNumber: "1234567890",
        accountName: "NGUYEN VAN A",
        amount: 150_000,
        description: "ELove pro monthly",
        orderCode: Date.now(),
        currency: "VND",
        paymentLinkId: "link_123",
        status: "PENDING",
        qrCode: "qr_data",
      }),
    },
    webhooks: { verify: vi.fn() },
  } as unknown as import("@payos/node").PayOS;
}

function createTestDb(overrides: Partial<ReturnType<typeof buildDefaultDb>> = {}) {
  return { ...buildDefaultDb(), ...overrides } as unknown as Db;
}

function buildDefaultDb() {
  return {
    query: {
      plans: {
        findFirst: vi.fn().mockResolvedValue({
          id: "pro",
          name: "Pro",
          billing_type: "recurring",
          payos_price_refs: { monthly: 150_000, yearly: 1_500_000 },
        }),
      },
      subscriptions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      webhook_events: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        catch: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BillingService", () => {
  let mockPayos: ReturnType<typeof createMockPayos>;
  let db: Db;

  beforeEach(() => {
    mockPayos = createMockPayos();
    db = createTestDb();
    vi.clearAllMocks();
  });

  describe("createCheckoutLink", () => {
    it("returns a PayOS checkout URL for pro monthly plan", async () => {
      const service = new BillingService(mockPayos, db);

      const result = await service.createCheckoutLink({
        tenantId: "tenant-1",
        planId: "pro",
        billingCycle: "monthly",
      });

      expect(result.checkoutUrl).toContain("payos.vn");
      expect(result.orderCode).toBeTypeOf("number");
    });

    it("calls paymentRequests.create with correct amount for pro monthly", async () => {
      const service = new BillingService(mockPayos, db);

      await service.createCheckoutLink({
        tenantId: "tenant-1",
        planId: "pro",
        billingCycle: "monthly",
      });

      expect(mockPayos.paymentRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 150_000,
          description: "ELove pro monthly",
        }),
      );
    });

    it("calls paymentRequests.create with correct amount for pro yearly", async () => {
      const yearlyDb = createTestDb({
        query: {
          plans: {
            findFirst: vi.fn().mockResolvedValue({
              id: "pro",
              name: "Pro",
              billing_type: "recurring",
              payos_price_refs: { monthly: 150_000, yearly: 1_500_000 },
            }),
          },
          subscriptions: { findFirst: vi.fn().mockResolvedValue(null) },
          webhook_events: { findFirst: vi.fn().mockResolvedValue(null) },
        } as unknown as ReturnType<typeof buildDefaultDb>["query"],
      });

      const service = new BillingService(mockPayos, yearlyDb);

      await service.createCheckoutLink({
        tenantId: "tenant-1",
        planId: "pro",
        billingCycle: "yearly",
      });

      expect(mockPayos.paymentRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1_500_000 }),
      );
    });

    it("uses one_time amount for lifetime plan", async () => {
      const lifetimeDb = createTestDb({
        query: {
          plans: {
            findFirst: vi.fn().mockResolvedValue({
              id: "lifetime",
              name: "Lifetime",
              billing_type: "one_time",
              payos_price_refs: { lifetime: 4_990_000 },
            }),
          },
          subscriptions: { findFirst: vi.fn().mockResolvedValue(null) },
          webhook_events: { findFirst: vi.fn().mockResolvedValue(null) },
        } as unknown as ReturnType<typeof buildDefaultDb>["query"],
      });

      const service = new BillingService(mockPayos, lifetimeDb);

      await service.createCheckoutLink({
        tenantId: "tenant-1",
        planId: "lifetime",
        billingCycle: "lifetime",
      });

      expect(mockPayos.paymentRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: expect.any(Number) }),
      );
      const callArg = (mockPayos.paymentRequests.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArg.amount).toBeGreaterThan(0);
    });

    it("throws when plan does not exist", async () => {
      const missingDb = createTestDb({
        query: {
          plans: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          subscriptions: { findFirst: vi.fn().mockResolvedValue(null) },
          webhook_events: { findFirst: vi.fn().mockResolvedValue(null) },
        } as unknown as ReturnType<typeof buildDefaultDb>["query"],
      });

      const service = new BillingService(mockPayos, missingDb);

      await expect(
        service.createCheckoutLink({
          tenantId: "t1",
          planId: "pro",
          billingCycle: "monthly",
        }),
      ).rejects.toThrow("Plan không tồn tại");
    });

    it("throws when billing cycle is invalid for the plan", async () => {
      // pro plan has no 'lifetime' cycle
      const service = new BillingService(mockPayos, db);

      await expect(
        service.createCheckoutLink({
          tenantId: "t1",
          planId: "pro",
          billingCycle: "lifetime",
        }),
      ).rejects.toThrow("Billing cycle không hợp lệ");
    });

    it("includes returnUrl and cancelUrl with correct domain", async () => {
      process.env.ELOVE_APP_URL = "https://test.elove.vn";
      const service = new BillingService(mockPayos, db);

      await service.createCheckoutLink({
        tenantId: "t1",
        planId: "pro",
        billingCycle: "monthly",
      });

      const call = (mockPayos.paymentRequests.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.returnUrl).toContain("test.elove.vn");
      expect(call.cancelUrl).toContain("test.elove.vn");

      delete process.env.ELOVE_APP_URL;
    });
  });

  describe("getSubscription", () => {
    it("returns null when no subscription exists", async () => {
      const service = new BillingService(mockPayos, db);
      const result = await service.getSubscription("tenant-1");
      expect(result).toBeNull();
    });
  });

  describe("cancelSubscription", () => {
    it("updates subscription status to canceled", async () => {
      const service = new BillingService(mockPayos, db);
      await service.cancelSubscription("tenant-1");

      expect((db as ReturnType<typeof buildDefaultDb>).update).toHaveBeenCalled();
    });
  });
});
