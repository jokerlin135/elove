import { initTRPC, TRPCError } from "@trpc/server";
import { createServerSupabase } from "./supabase";
import { createDb, tenants, users } from "@elove/shared";
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

export async function createContext({ req }: FetchCreateContextFnOptions) {
  // Extract Bearer token from Authorization header
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
        const db = getDb();
        let dbUser = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, data.user!.id),
        });
        // Auto-provision: create tenant + user record if missing (email/password signup bypasses /auth/callback)
        if (!dbUser) {
          const email = data.user.email ?? "";
          const slug = email
            .split("@")[0]
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
          const tenantId = randomUUID();
          await db.insert(tenants).values({
            id: tenantId,
            slug: `${slug}-${tenantId.slice(0, 6)}`,
            plan_id: "free",
          });
          await db.insert(users).values({
            id: data.user.id,
            tenant_id: tenantId,
            email,
            role: "owner",
          });
          dbUser = {
            id: data.user.id,
            tenant_id: tenantId,
            email,
            role: "owner",
          } as any;
        }
        tenantId = dbUser?.tenant_id ?? null;
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
