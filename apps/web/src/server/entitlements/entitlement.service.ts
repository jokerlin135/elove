import { sql } from "drizzle-orm";
import type { Db } from "@elove/shared";

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

export class EntitlementService {
  constructor(private db: Db) {}

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

    // 2. DB query with override priority
    const rows = await this.db.execute(sql`
      SELECT
        COALESCE(eo.value, pe.value) AS value,
        CASE WHEN eo.value IS NOT NULL THEN 'override' ELSE 'plan' END AS source
      FROM plan_entitlements pe
      JOIN subscriptions s ON s.plan_id = pe.plan_id AND s.tenant_id = ${tenantId}
      LEFT JOIN entitlement_overrides eo ON eo.tenant_id = ${tenantId}
        AND eo.feature_key = ${featureKey}
        AND (eo.expires_at IS NULL OR eo.expires_at > NOW())
      WHERE pe.feature_key = ${featureKey}
      LIMIT 1
    `);

    const row = rows[0] as { value: string; source: string } | undefined;

    if (!row) return { value: "0", source: "plan" };

    const result = {
      value: String(row.value),
      source: String(row.source) as "plan" | "override",
    };

    // 3. Cache result
    entitlementCache.set(cacheKey, {
      ...result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
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
