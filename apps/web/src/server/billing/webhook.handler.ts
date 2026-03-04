import { eq } from "drizzle-orm";
import { webhook_events, subscriptions, billing_events, type Db } from "@elove/shared";
import type { Webhook } from "@payos/node";

export interface PaymentMetadata {
  tenant_id: string;
  plan_id: string;
  billing_cycle: string;
}

export type PayOSWebhookEvent = Webhook;

export class WebhookHandler {
  constructor(private readonly db: Db) {}

  async process(
    eventId: string,
    event: PayOSWebhookEvent,
    metadata: PaymentMetadata,
  ): Promise<void> {
    // Idempotency check — skip already-processed events
    const existing = await this.db.query.webhook_events.findFirst({
      where: (w, { eq: eqFn }) => eqFn(w.event_id, eventId),
    });

    if (existing?.status === "processed") {
      return;
    }

    // Insert a "processing" record; ignore conflict if the row already exists
    await this.db
      .insert(webhook_events)
      .values({
        event_id: eventId,
        event_type: "payos_payment",
        status: "processing",
        payload: event as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();

    try {
      const isPaid =
        event.code === "00" &&
        event.success === true &&
        event.data?.code === "00";

      if (isPaid) {
        await this._activateSubscription(metadata, event.data.orderCode);
      }

      // Mark event as processed
      await this.db
        .update(webhook_events)
        .set({ status: "processed" })
        .where(eq(webhook_events.event_id, eventId));
    } catch (err) {
      await this.db
        .update(webhook_events)
        .set({ status: "failed" })
        .where(eq(webhook_events.event_id, eventId));
      throw err;
    }
  }

  private async _activateSubscription(
    metadata: PaymentMetadata,
    orderCode: number,
  ): Promise<void> {
    const { tenant_id, plan_id, billing_cycle } = metadata;

    const isLifetime = billing_cycle === "lifetime";
    const status = isLifetime ? "lifetime" : "active";
    const billingType = isLifetime ? "one_time" : "recurring";

    // Upsert subscription for the tenant
    await this.db
      .insert(subscriptions)
      .values({
        tenant_id,
        plan_id,
        status,
        billing_type: billingType,
        payos_order_code: String(orderCode),
        current_period_start: new Date(),
        current_period_end: isLifetime ? null : this._nextPeriodEnd(billing_cycle),
      })
      .onConflictDoUpdate({
        target: subscriptions.tenant_id,
        set: {
          plan_id,
          status,
          billing_type: billingType,
          payos_order_code: String(orderCode),
          current_period_start: new Date(),
          current_period_end: isLifetime ? null : this._nextPeriodEnd(billing_cycle),
        },
      });

    // Log billing event (non-blocking)
    this.db
      .insert(billing_events)
      .values({
        tenant_id,
        event_type: "subscription_activated",
        metadata: { plan_id, billing_cycle, orderCode } as Record<string, unknown>,
      })
      .catch(() => {});
  }

  private _nextPeriodEnd(billingCycle: string): Date {
    const now = new Date();
    if (billingCycle === "yearly") {
      now.setFullYear(now.getFullYear() + 1);
    } else {
      // monthly default
      now.setMonth(now.getMonth() + 1);
    }
    return now;
  }
}
