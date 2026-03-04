import { eq } from "drizzle-orm";
import {
  plans,
  subscriptions,
  billing_events,
  type Db,
} from "@elove/shared";
import type { PayOS } from "@payos/node";

export type BillingCycle = "monthly" | "yearly" | "lifetime";
export type PlanId = "pro" | "lifetime";

export interface CreateCheckoutLinkParams {
  tenantId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
}

export interface CreateCheckoutLinkResult {
  checkoutUrl: string;
  orderCode: number;
}

// Price map in VND — fallback when plan has no payos_price_refs configured
const PLAN_PRICE_VND: Record<string, Record<string, number>> = {
  pro: { monthly: 150_000, yearly: 1_500_000 },
  lifetime: { lifetime: 4_990_000 },
};

export class BillingService {
  constructor(
    private readonly payos: PayOS,
    private readonly db: Db,
  ) {}

  async createCheckoutLink({
    tenantId,
    planId,
    billingCycle,
  }: CreateCheckoutLinkParams): Promise<CreateCheckoutLinkResult> {
    const plan = await this.db.query.plans.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.id, planId),
    });

    if (!plan) {
      throw new Error(`Plan không tồn tại: ${planId}`);
    }

    // Resolve amount from DB refs, then fallback to hardcoded map
    const priceRefs =
      (plan.payos_price_refs as Record<string, number> | null) ??
      PLAN_PRICE_VND[planId] ??
      {};
    const amount = priceRefs[billingCycle];

    if (amount === undefined || amount === null) {
      throw new Error(
        `Billing cycle không hợp lệ: ${billingCycle} cho plan ${planId}`,
      );
    }

    const orderCode = Date.now();
    const appUrl = process.env.ELOVE_APP_URL ?? "https://elove.vn";

    const result = await this.payos.paymentRequests.create({
      orderCode,
      amount,
      description: `ELove ${planId} ${billingCycle}`,
      returnUrl: `${appUrl}/dashboard?payment=success`,
      cancelUrl: `${appUrl}/dashboard?payment=cancelled`,
    });

    // Log billing event (non-blocking — failures must not break checkout)
    this.db
      .insert(billing_events)
      .values({
        tenant_id: tenantId,
        event_type: "payment_initiated",
        metadata: { orderCode, planId, billingCycle } as Record<string, unknown>,
      })
      .catch(() => {});

    return { checkoutUrl: result.checkoutUrl, orderCode };
  }

  async getSubscription(tenantId: string) {
    return this.db.query.subscriptions.findFirst({
      where: (s, { eq: eqFn }) => eqFn(s.tenant_id, tenantId),
    });
  }

  async cancelSubscription(tenantId: string) {
    await this.db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.tenant_id, tenantId));
  }
}
