import type { SupabaseAdminDb } from "../supabase-admin-db";
import type { Webhook } from "@payos/node";

export interface PaymentMetadata {
  tenant_id: string;
  plan_id: string;
  billing_cycle: string;
}

export type PayOSWebhookEvent = Webhook;

export class WebhookHandler {
  constructor(private readonly supa: SupabaseAdminDb) {}

  async process(
    eventId: string,
    event: PayOSWebhookEvent,
    metadata: PaymentMetadata,
  ): Promise<void> {
    // Idempotency check — skip already-processed events
    const existing = await this.supa.findFirst<{ status: string }>(
      "webhook_events",
      { event_id: eventId },
    );

    if (existing?.status === "processed") {
      return;
    }

    // Insert a "processing" record; ignore conflict if the row already exists
    await this.supa.insertIgnore("webhook_events", {
      event_id: eventId,
      event_type: "payos_payment",
      status: "processing",
      payload: event as unknown as Record<string, unknown>,
    });

    try {
      const isPaid =
        event.code === "00" &&
        event.success === true &&
        event.data?.code === "00";

      if (isPaid) {
        await this._activateSubscription(metadata, event.data.orderCode);
      }

      // Mark event as processed
      await this.supa.update(
        "webhook_events",
        { event_id: eventId },
        { status: "processed" },
      );
    } catch (err) {
      await this.supa.update(
        "webhook_events",
        { event_id: eventId },
        { status: "failed" },
      );
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

    // Upsert subscription for the tenant (merge-duplicates handles ON CONFLICT DO UPDATE)
    await this.supa.upsert("subscriptions", {
      tenant_id,
      plan_id,
      status,
      billing_type: billingType,
      payos_order_code: String(orderCode),
      current_period_start: new Date().toISOString(),
      current_period_end: isLifetime
        ? null
        : this._nextPeriodEnd(billing_cycle).toISOString(),
    });

    // Log billing event (non-blocking)
    this.supa
      .insert("billing_events", {
        tenant_id,
        event_type: "subscription_activated",
        metadata: { plan_id, billing_cycle, orderCode },
      })
      .catch(() => {});
  }

  private _nextPeriodEnd(billingCycle: string): Date {
    const now = new Date();
    if (billingCycle === "yearly") {
      now.setFullYear(now.getFullYear() + 1);
    } else {
      now.setMonth(now.getMonth() + 1);
    }
    return now;
  }
}
