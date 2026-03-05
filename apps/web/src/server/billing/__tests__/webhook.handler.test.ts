import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookHandler } from "../webhook.handler";
import type { PayOSWebhookEvent, PaymentMetadata } from "../webhook.handler";

function createMockSupa() {
  return {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
    insertIgnore: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function makePaidEvent(orderCode = 1_234_567_890): PayOSWebhookEvent {
  return {
    code: "00",
    desc: "Thanh toan thanh cong",
    success: true,
    signature: "valid_sig",
    data: {
      orderCode,
      amount: 150_000,
      description: "ELove pro monthly",
      accountNumber: "0123456789",
      reference: "REF123",
      transactionDateTime: "2026-03-04T10:00:00Z",
      currency: "VND",
      paymentLinkId: "link_abc",
      code: "00",
      desc: "Thanh toan thanh cong",
    },
  };
}

const defaultMetadata: PaymentMetadata = {
  tenant_id: "tenant-1",
  plan_id: "pro",
  billing_cycle: "monthly",
};

describe("WebhookHandler", () => {
  let mockSupa: ReturnType<typeof createMockSupa>;
  let handler: WebhookHandler;

  beforeEach(() => {
    mockSupa = createMockSupa();
    handler = new WebhookHandler(mockSupa as any);
    vi.clearAllMocks();
  });

  describe("process — PAID event", () => {
    it("processes a PAID event without throwing", async () => {
      const event = makePaidEvent();
      await expect(
        handler.process("evt-001", event, defaultMetadata),
      ).resolves.not.toThrow();
    });

    it("inserts webhook_event with processing status first", async () => {
      const event = makePaidEvent();
      await handler.process("evt-001", event, defaultMetadata);
      expect(mockSupa.insertIgnore).toHaveBeenCalledWith(
        "webhook_events",
        expect.objectContaining({ event_id: "evt-001", status: "processing" }),
      );
    });

    it("marks webhook_event as processed after success", async () => {
      const event = makePaidEvent();
      await handler.process("evt-001", event, defaultMetadata);
      expect(mockSupa.update).toHaveBeenCalledWith(
        "webhook_events",
        { event_id: "evt-001" },
        { status: "processed" },
      );
    });

    it("upserts subscription for the tenant on PAID", async () => {
      const event = makePaidEvent();
      await handler.process("evt-001", event, defaultMetadata);
      expect(mockSupa.upsert).toHaveBeenCalledWith(
        "subscriptions",
        expect.objectContaining({ tenant_id: "tenant-1", status: "active" }),
      );
    });

    it("sets status=lifetime for lifetime billing cycle", async () => {
      const event = makePaidEvent();
      const lifetimeMetadata: PaymentMetadata = {
        tenant_id: "tenant-2",
        plan_id: "lifetime",
        billing_cycle: "lifetime",
      };

      await expect(
        handler.process("evt-002", event, lifetimeMetadata),
      ).resolves.not.toThrow();

      expect(mockSupa.upsert).toHaveBeenCalledWith(
        "subscriptions",
        expect.objectContaining({ status: "lifetime" }),
      );
    });
  });

  describe("process — non-PAID event", () => {
    it("does not create subscription for non-PAID event (code != 00)", async () => {
      const cancelledEvent: PayOSWebhookEvent = {
        code: "01",
        desc: "Da huy",
        success: false,
        signature: "sig",
        data: {
          orderCode: 999,
          amount: 150_000,
          description: "ELove pro monthly",
          accountNumber: "0123456789",
          reference: "REF456",
          transactionDateTime: "2026-03-04T10:00:00Z",
          currency: "VND",
          paymentLinkId: "link_xyz",
          code: "01",
          desc: "Da huy",
        },
      };

      await expect(
        handler.process("evt-003", cancelledEvent, defaultMetadata),
      ).resolves.not.toThrow();

      expect(mockSupa.upsert).not.toHaveBeenCalled();
      expect(mockSupa.update).toHaveBeenCalledWith(
        "webhook_events",
        { event_id: "evt-003" },
        { status: "processed" },
      );
    });
  });

  describe("idempotency", () => {
    it("skips processing duplicate event_id that is already processed", async () => {
      const supaWithExisting = createMockSupa();
      supaWithExisting.findFirst.mockResolvedValue({
        event_id: "evt-dupe",
        status: "processed",
      });

      const dedupHandler = new WebhookHandler(supaWithExisting as any);
      await expect(
        dedupHandler.process("evt-dupe", makePaidEvent(), defaultMetadata),
      ).resolves.not.toThrow();

      // insert should NOT be called since we return early
      expect(supaWithExisting.insertIgnore).not.toHaveBeenCalled();
    });

    it("does not throw when the same event is processed twice", async () => {
      await handler.process("evt-same", makePaidEvent(), defaultMetadata);

      // Second call: simulate event now exists as "processed"
      const processedSupa = createMockSupa();
      processedSupa.findFirst.mockResolvedValue({
        event_id: "evt-same",
        status: "processed",
      });

      const secondHandler = new WebhookHandler(processedSupa as any);
      await expect(
        secondHandler.process("evt-same", makePaidEvent(), defaultMetadata),
      ).resolves.not.toThrow();
    });

    it("does not skip event that is in processing state (allows retry)", async () => {
      const supaProcessing = createMockSupa();
      supaProcessing.findFirst.mockResolvedValue({
        event_id: "evt-retry",
        status: "processing",
      });

      const retryHandler = new WebhookHandler(supaProcessing as any);
      await expect(
        retryHandler.process("evt-retry", makePaidEvent(), defaultMetadata),
      ).resolves.not.toThrow();

      expect(supaProcessing.insertIgnore).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("marks event as failed and rethrows when subscription upsert fails", async () => {
      const errorSupa = createMockSupa();
      errorSupa.upsert.mockRejectedValue(new Error("DB error"));

      const errorHandler = new WebhookHandler(errorSupa as any);

      await expect(
        errorHandler.process("evt-fail", makePaidEvent(), defaultMetadata),
      ).rejects.toThrow("DB error");

      // Status should have been set to "failed"
      expect(errorSupa.update).toHaveBeenCalledWith(
        "webhook_events",
        { event_id: "evt-fail" },
        { status: "failed" },
      );
    });
  });
});
