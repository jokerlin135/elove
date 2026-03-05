import type { SupabaseAdminDb } from "../supabase-admin-db";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level cache — shared across instances within the same process.
// Use clearEntitlementCache() in tests to reset state between test cases.
const entitlementCache = new Map<
  string,
  { value: string; source: string; expiresAt: number }
>();

export function clearEntitlementCache(): void {
  entitlementCache.clear();
}

type Subscription = { plan_id: string };
type PlanEntitlement = { value: string };
type EntitlementOverride = { value: string; expires_at: string | null };

export class EntitlementService {
  constructor(private supa: SupabaseAdminDb) {}

  async get(
    tenantId: string,
    featureKey: string,
  ): Promise<{ value: string; source: "plan" | "override" }> {
    // 1. In-memory cache check
    const cacheKey = `${tenantId}:${featureKey}`;
    const cached = entitlementCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        value: cached.value,
        source: cached.source as "plan" | "override",
      };
    }

    // 2. Check override first (higher priority)
    const override = await this.supa.findFirst<EntitlementOverride>(
      "entitlement_overrides",
      { tenant_id: tenantId, feature_key: featureKey },
    );

    if (override && (override.expires_at === null || new Date(override.expires_at) > new Date())) {
      const result = { value: override.value, source: "override" as const };
      entitlementCache.set(cacheKey, {
        ...result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return result;
    }

    // 3. Get plan entitlement via subscription
    const subscription = await this.supa.findFirst<Subscription>(
      "subscriptions",
      { tenant_id: tenantId },
    );

    if (subscription) {
      const planEntitlement = await this.supa.findFirst<PlanEntitlement>(
        "plan_entitlements",
        { plan_id: subscription.plan_id, feature_key: featureKey },
      );
      if (planEntitlement) {
        const result = { value: planEntitlement.value, source: "plan" as const };
        entitlementCache.set(cacheKey, {
          ...result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return result;
      }
    }

    return { value: "0", source: "plan" };
  }

  async checkQuota(
    tenantId: string,
    quotaKey: string,
    currentCount: number,
  ): Promise<{
    allowed: boolean;
    current: number;
    limit: number | "unlimited";
  }> {
    const entitlement = await this.get(tenantId, quotaKey);
    if (entitlement.value === "unlimited") {
      return { allowed: true, current: currentCount, limit: "unlimited" };
    }
    const limit = parseInt(entitlement.value, 10);
    return { allowed: currentCount < limit, current: currentCount, limit };
  }
}
