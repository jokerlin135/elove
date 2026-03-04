import { createTRPCReact, type CreateTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/app.router";
import { createBrowserClient } from "@supabase/ssr";

export const trpc: CreateTRPCReact<AppRouter, unknown, null> =
  createTRPCReact<AppRouter>();

export function makeTRPCClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        async headers() {
          try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            return token ? { authorization: `Bearer ${token}` } : {};
          } catch {
            return {};
          }
        },
      }),
    ],
  });
}
