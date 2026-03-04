import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createDb, tenants, users } from "@elove/shared";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const db = createDb(process.env.DATABASE_URL!);
          const existing = await db.query.users.findFirst({
            where: (u, { eq }) => eq(u.id, user.id),
          });

          if (!existing) {
            const email = user.email ?? "";
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
              id: user.id,
              tenant_id: tenantId,
              email,
              role: "owner",
            });
          }
        } catch (dbError) {
          console.error("Failed to provision user in DB:", dbError);
          // Non-fatal — user can still use the app
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
