import { NextResponse } from "next/server";
import { createServerSupabase } from "../../../server/supabase";
import { createDb } from "@elove/shared";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  const result: Record<string, unknown> = {
    hasToken: !!token,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
    dbUrl: process.env.DATABASE_URL ? "set" : "MISSING",
  };

  if (token) {
    try {
      const supabase = createServerSupabase();
      const { data, error } = await supabase.auth.getUser(token);
      result.authUser = data.user ? { id: data.user.id, email: data.user.email } : null;
      result.authError = error?.message ?? null;

      if (data.user) {
        try {
          const db = createDb(process.env.DATABASE_URL!);
          const dbUser = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, data.user!.id),
          });
          result.dbUser = dbUser ?? null;
          result.dbError = null;
        } catch (e: unknown) {
          result.dbUser = null;
          result.dbError = String(e);
        }
      }
    } catch (e: unknown) {
      result.authError = String(e);
    }
  }

  return NextResponse.json(result);
}
