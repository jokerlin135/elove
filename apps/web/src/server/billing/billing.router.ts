import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PayOS } from "@payos/node";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { BillingService } from "./billing.service";
import { WebhookHandler } from "./webhook.handler";

// Lazy PayOS singleton — initialized on first use
let _payos: PayOS | null = null;

function getPayOS(): PayOS {
  if (!_payos) {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "PayOS credentials chưa được cấu hình",
      });
    }

    _payos = new PayOS({ clientId, apiKey, checksumKey });
  }
  return _payos;
}

const createCheckoutSchema = z.object({
  planId: z.enum(["pro", "lifetime"]),
  billingCycle: z.enum(["monthly", "yearly", "lifetime"]),
});

const webhookBodySchema = z.object({
  eventId: z.string().min(1),
  code: z.string(),
  desc: z.string().optional().default(""),
  success: z.boolean(),
  signature: z.string(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string().optional().default(""),
    reference: z.string().optional().default(""),
    transactionDateTime: z.string().optional().default(""),
    currency: z.string().optional().default("VND"),
    paymentLinkId: z.string().optional().default(""),
    code: z.string().optional().default(""),
    desc: z.string().optional().default(""),
  }),
  metadata: z.object({
    tenant_id: z.string(),
    plan_id: z.string(),
    billing_cycle: z.string(),
  }),
});

export const billingRouter = router({
  createCheckoutLink: protectedProcedure
    .input(createCheckoutSchema)
    .mutation(async ({ input, ctx }) => {
      const payos = getPayOS();
      const service = new BillingService(payos, ctx.supa);

      const result = await service.createCheckoutLink({
        tenantId: ctx.tenantId,
        planId: input.planId,
        billingCycle: input.billingCycle,
      });

      return result;
    }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const payos = getPayOS();
    const service = new BillingService(payos, ctx.supa);
    return service.getSubscription(ctx.tenantId);
  }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const payos = getPayOS();
    const service = new BillingService(payos, ctx.supa);
    await service.cancelSubscription(ctx.tenantId);
    return { success: true };
  }),

  // Public endpoint — called by PayOS webhook server
  handleWebhook: publicProcedure
    .input(webhookBodySchema)
    .mutation(async ({ input, ctx }) => {
      const payos = getPayOS();

      // Verify webhook signature
      const webhookPayload = {
        code: input.code,
        desc: input.desc,
        success: input.success,
        signature: input.signature,
        data: {
          ...input.data,
          accountNumber: input.data.accountNumber ?? "",
          reference: input.data.reference ?? "",
          transactionDateTime: input.data.transactionDateTime ?? "",
          currency: input.data.currency ?? "VND",
          paymentLinkId: input.data.paymentLinkId ?? "",
          code: input.data.code ?? "",
          desc: input.data.desc ?? "",
        },
      };

      try {
        await payos.webhooks.verify(webhookPayload);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Webhook signature không hợp lệ",
        });
      }

      const handler = new WebhookHandler(ctx.supa);
      await handler.process(input.eventId, webhookPayload, input.metadata);

      return { received: true };
    }),
});
