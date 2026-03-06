import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "../billing.service";

function createMockSupa(overrides: Record<string, unknown> = {}) {
  return {
    findFirst: vi.fn().mockResolvedValue({
      id: "pro",
      name: "Pro",
      billing_type: "recurring",
      payos_price_refs: { monthly: 150_000, yearly: 1_500_000 },
    }),
    findMany: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
    insertIgnore: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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

describe("BillingService", () => {
  let mockPayos: ReturnType<typeof createMockPayos>;
  let mockSupa: ReturnType<typeof createMockSupa>;

  beforeEach(() => {
    mockPayos = createMockPayos();
    mockSupa = createMockSupa();
    vi.clearAllMocks();
  });

  describe("createCheckoutLink", () => {
    it("returns a PayOS checkout URL for pro monthly plan", async () => {
      const service = new BillingService(mockPayos, mockSupa as any);

      const result = await service.createCheckoutLink({
        tenantId: "tenant-1",
        planId: "pro",
        billingCycle: "monthly",
      });

      expect(result.checkoutUrl).toContain("payos.vn");
      expect(result.orderCode).toBeTypeOf("number");
    });

    it("calls paymentRequests.create with correct amount for pro monthly", async () => {
      const service = new BillingService(mockPayos, mockSupa as any);

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
      const service = new BillingService(mockPayos, mockSupa as any);

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
      const lifetimeSupa = createMockSupa();
      lifetimeSupa.findFirst.mockResolvedValue({
        id: "lifetime",
        name: "Lifetime",
        billing_type: "one_time",
        payos_price_refs: { lifetime: 4_990_000 },
      });

      const service = new BillingService(mockPayos, lifetimeSupa as any);

      await service.createCheckoutLink({
        tenantId: "tenant-1",
        planId: "lifetime",
        billingCycle: "lifetime",
      });

      const callArg = (
        mockPayos.paymentRequests.create as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      expect(callArg.amount).toBeGreaterThan(0);
    });

    it("throws when plan does not exist", async () => {
      const missingPlanSupa = createMockSupa();
      missingPlanSupa.findFirst.mockResolvedValue(null);
      const service = new BillingService(mockPayos, missingPlanSupa as any);

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
      const service = new BillingService(mockPayos, mockSupa as any);

      await expect(
        service.createCheckoutLink({
          tenantId: "t1",
          planId: "pro",
          billingCycle: "lifetime",
        }),
      ).rejects.toThrow("Billing cycle không hợp lệ");
    });

    it("includes returnUrl and cancelUrl with correct domain", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://test.elove.vn";
      const service = new BillingService(mockPayos, mockSupa as any);

      await service.createCheckoutLink({
        tenantId: "t1",
        planId: "pro",
        billingCycle: "monthly",
      });

      const call = (
        mockPayos.paymentRequests.create as ReturnType<typeof vi.fn>
      ).mock.calls[0][0];
      expect(call.returnUrl).toContain("test.elove.vn");
      expect(call.cancelUrl).toContain("test.elove.vn");

      delete process.env.NEXT_PUBLIC_APP_URL;
    });
  });

  describe("getSubscription", () => {
    it("returns null when no subscription exists", async () => {
      const noSubSupa = createMockSupa();
      noSubSupa.findFirst.mockResolvedValue(null);
      const service = new BillingService(mockPayos, noSubSupa as any);
      const result = await service.getSubscription("tenant-1");
      expect(result).toBeNull();
    });
  });

  describe("cancelSubscription", () => {
    it("updates subscription status to canceled", async () => {
      const service = new BillingService(mockPayos, mockSupa as any);
      await service.cancelSubscription("tenant-1");
      expect(mockSupa.update).toHaveBeenCalledWith(
        "subscriptions",
        { tenant_id: "tenant-1" },
        { status: "canceled" },
      );
    });
  });
});
