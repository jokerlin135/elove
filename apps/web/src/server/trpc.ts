import { initTRPC, TRPCError } from "@trpc/server";
import { createServerSupabase } from "./supabase";
import { createDb } from "@elove/shared";
import { createR2Client } from "./r2";
import { randomUUID } from "crypto";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

// Lazy singletons — initialized on first request
let _db: ReturnType<typeof createDb> | null = null;
let _r2: ReturnType<typeof createR2Client> | null = null;

function getDb() {
  if (!_db) _db = createDb(process.env.DATABASE_URL!);
  return _db;
}

function getR2() {
  if (!_r2) _r2 = createR2Client();
  return _r2;
}

// Use Supabase REST API to look up user (avoids direct DB connection DNS issues)
async function getOrProvisionUser(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
  email: string,
): Promise<string | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  // Lookup user via REST API
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=tenant_id&limit=1`,
    { headers },
  );
  if (lookupRes.ok) {
    const rows = (await lookupRes.json()) as { tenant_id: string }[];
    if (rows.length > 0) return rows[0].tenant_id;
  }

  // Not found — auto-provision
  const slug = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  const tenantId = randomUUID();

  const tenantRes = await fetch(`${SUPABASE_URL}/rest/v1/tenants`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: tenantId, slug: `${slug}-${tenantId.slice(0, 6)}`, plan_id: "free" }),
  });
  if (!tenantRes.ok) return null;

  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: userId, tenant_id: tenantId, email, role: "owner" }),
  });
  if (!userRes.ok) return null;

  return tenantId;
}

export async function createContext({ req }: FetchCreateContextFnOptions) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  let user: { id: string; email?: string } | null = null;
  let tenantId: string | null = null;

  if (token) {
    try {
      const supabase = createServerSupabase();
      const { data } = await supabase.auth.getUser(token);
      if (data.user) {
        user = { id: data.user.id, email: data.user.email };
        tenantId = await getOrProvisionUser(supabase, data.user.id, data.user.email ?? "");
      }
    } catch {
      // Invalid token — user remains null
    }
  }

  return {
    db: getDb(),
    r2: getR2(),
    user,
    tenantId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
    },
  });
});
