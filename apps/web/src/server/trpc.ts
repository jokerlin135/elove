import { initTRPC, TRPCError } from "@trpc/server";
import { createServerSupabase } from "./supabase";
import { createDb } from "@elove/shared";
import { createR2Client } from "./r2";
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
        // Look up tenant from users table
        const db = getDb();
        const dbUser = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, data.user!.id),
        });
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
