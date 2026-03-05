import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import { EntitlementService } from "../entitlements/entitlement.service";

export function requireEntitlement(featureKey: string) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const service = new EntitlementService(ctx.supa);
    const result = await service.get(ctx.tenantId, featureKey);
    if (result.value === "0") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Feature ${featureKey} not available on your plan`,
      });
    }
    return next({ ctx: { ...ctx, entitlement: result } });
  });
}
