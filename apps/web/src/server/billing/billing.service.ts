import type { SupabaseAdminDb } from "../supabase-admin-db";
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

type Plan = {
  id: string;
  payos_price_refs: Record<string, number> | null;
};

type Subscription = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  billing_type: string;
  payos_order_code: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

// Price map in VND — fallback when plan has no payos_price_refs configured
const PLAN_PRICE_VND: Record<string, Record<string, number>> = {
  pro: { monthly: 150_000, yearly: 1_500_000 },
  lifetime: { lifetime: 4_990_000 },
};

export class BillingService {
  constructor(
    private readonly payos: PayOS,
    private readonly supa: SupabaseAdminDb,
  ) { }

  async createCheckoutLink({
    tenantId,
    planId,
    billingCycle,
  }: CreateCheckoutLinkParams): Promise<CreateCheckoutLinkResult> {
    const plan = await this.supa.findFirst<Plan>("plans", { id: planId });

    if (!plan) {
      throw new Error(`Plan không tồn tại: ${planId}`);
    }

    const priceRefs = plan.payos_price_refs ?? PLAN_PRICE_VND[planId] ?? {};
    const amount = priceRefs[billingCycle];

    if (amount === undefined || amount === null) {
      throw new Error(
        `Billing cycle không hợp lệ: ${billingCycle} cho plan ${planId}`,
      );
    }

    const orderCode = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://elove.vn";

    const result = await this.payos.paymentRequests.create({
      orderCode,
      amount,
      description: `ELove ${planId} ${billingCycle}`,
      returnUrl: `${appUrl}/dashboard?payment=success`,
      cancelUrl: `${appUrl}/dashboard?payment=cancelled`,
    });

    // Log billing event (non-blocking — failures must not break checkout)
    this.supa
      .insert("billing_events", {
        tenant_id: tenantId,
        event_type: "payment_initiated",
        metadata: { orderCode, planId, billingCycle },
      })
      .catch(() => { });

    return { checkoutUrl: result.checkoutUrl, orderCode };
  }

  async getSubscription(tenantId: string) {
    return this.supa.findFirst<Subscription>("subscriptions", {
      tenant_id: tenantId,
    });
  }

  async cancelSubscription(tenantId: string) {
    await this.supa.update(
      "subscriptions",
      { tenant_id: tenantId },
      { status: "canceled" },
    );
  }
}
