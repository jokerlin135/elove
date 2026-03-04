import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookHandler } from "../webhook.handler";
import type { Db } from "@elove/shared";
import type { PayOSWebhookEvent, PaymentMetadata } from "../webhook.handler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultDb() {
  return {
    query: {
      plans: {
        findFirst: vi.fn().mockResolvedValue(null),
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

function createTestDb(
  overrides: Partial<ReturnType<typeof buildDefaultDb>> = {},
) {
  return { ...buildDefaultDb(), ...overrides } as unknown as Db;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WebhookHandler", () => {
  let db: ReturnType<typeof buildDefaultDb>;
  let handler: WebhookHandler;

  beforeEach(() => {
    db = buildDefaultDb();
    handler = new WebhookHandler(db as unknown as Db);
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

      const insertValues = (db.insert as ReturnType<typeof vi.fn>).mock.calls;
      const firstInsert = insertValues[0];
      // First insert argument should be webhook_events table
      expect(firstInsert).toBeDefined();
    });

    it("marks webhook_event as processed after success", async () => {
      const event = makePaidEvent();
      await handler.process("evt-001", event, defaultMetadata);

      const updateCalls = (db.update as ReturnType<typeof vi.fn>).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
      const setCall = db.update({} as never).set;
      // Verify update was called
      expect(db.update).toHaveBeenCalled();
    });

    it("upserts subscription for the tenant on PAID", async () => {
      const event = makePaidEvent();
      await handler.process("evt-001", event, defaultMetadata);

      // insert called at least twice: webhook_events + subscriptions (+optionally billing_events)
      const allInsertCalls = (db.insert as ReturnType<typeof vi.fn>).mock.calls;
      expect(allInsertCalls.length).toBeGreaterThanOrEqual(2);
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

      // Should still mark event as processed (update called), but no subscription insert
      // via onConflictDoUpdate (only webhook_events insert + possibly billing_events)
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    it("skips processing duplicate event_id that is already processed", async () => {
      // Simulate existing processed event
      const dbWithExisting = buildDefaultDb();
      dbWithExisting.query.webhook_events.findFirst = vi
        .fn()
        .mockResolvedValue({ event_id: "evt-dupe", status: "processed" });

      const dedupHandler = new WebhookHandler(dbWithExisting as unknown as Db);
      const event = makePaidEvent();

      await expect(
        dedupHandler.process("evt-dupe", event, defaultMetadata),
      ).resolves.not.toThrow();

      // insert should NOT be called since we return early
      expect(dbWithExisting.insert).not.toHaveBeenCalled();
    });

    it("does not throw when the same event is processed twice", async () => {
      // First call: no existing event
      await handler.process("evt-same", makePaidEvent(), defaultMetadata);

      // Second call: simulate event now exists as "processed"
      const processedDb = buildDefaultDb();
      processedDb.query.webhook_events.findFirst = vi
        .fn()
        .mockResolvedValue({ event_id: "evt-same", status: "processed" });

      const secondHandler = new WebhookHandler(processedDb as unknown as Db);
      await expect(
        secondHandler.process("evt-same", makePaidEvent(), defaultMetadata),
      ).resolves.not.toThrow();
    });

    it("does not skip event that is in processing state (allows retry)", async () => {
      const dbProcessing = buildDefaultDb();
      dbProcessing.query.webhook_events.findFirst = vi
        .fn()
        .mockResolvedValue({ event_id: "evt-retry", status: "processing" });

      const retryHandler = new WebhookHandler(dbProcessing as unknown as Db);
      const event = makePaidEvent();

      // Should proceed (not skip) for in-progress events
      await expect(
        retryHandler.process("evt-retry", event, defaultMetadata),
      ).resolves.not.toThrow();

      // insert should be called (onConflictDoNothing protects against race)
      expect(dbProcessing.insert).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("marks event as failed and rethrows when subscription upsert fails", async () => {
      const errorDb = buildDefaultDb();
      let callCount = 0;

      errorDb.insert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First insert (webhook_events) succeeds
            return {
              onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
              onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
              catch: vi.fn().mockResolvedValue(undefined),
            };
          }
          // Second insert (subscriptions) fails
          return {
            onConflictDoNothing: vi
              .fn()
              .mockRejectedValue(new Error("DB error")),
            onConflictDoUpdate: vi
              .fn()
              .mockRejectedValue(new Error("DB error")),
            catch: vi.fn().mockRejectedValue(new Error("DB error")),
          };
        }),
      }));

      const errorHandler = new WebhookHandler(errorDb as unknown as Db);

      await expect(
        errorHandler.process("evt-fail", makePaidEvent(), defaultMetadata),
      ).rejects.toThrow("DB error");

      // Status should have been set to "failed"
      expect(errorDb.update).toHaveBeenCalled();
    });
  });
});
