"use client";
import dynamic from "next/dynamic";
import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ThemeSupa } from "@supabase/auth-ui-shared";

const Auth = dynamic(
  () => import("@supabase/auth-ui-react").then((m) => m.Auth),
  { ssr: false },
);

export default function LoginPage() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        router.push("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const appearance = useMemo(
    () => ({
      theme: ThemeSupa,
      variables: {
        default: {
          colors: {
            brand: "#f43f5e",
            brandAccent: "#e11d48",
            inputBackground: "rgba(255,255,255,0.05)",
            inputBorder: "rgba(255,255,255,0.1)",
            inputText: "white",
            inputLabelText: "rgba(255,255,255,0.6)",
            messageText: "rgba(255,255,255,0.5)",
            anchorTextColor: "#fb7185",
          },
          radii: { borderRadiusButton: "9999px", inputBorderRadius: "12px" },
        },
      },
      className: { container: "text-white" },
    }),
    [],
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <Auth
        supabaseClient={supabase}
        appearance={appearance}
        providers={["google"]}
        redirectTo={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`}
        view="sign_in"
        localization={{
          variables: {
            sign_in: {
              email_label: "Email",
              password_label: "Mật khẩu",
              button_label: "Đăng nhập",
              link_text: "Chưa có tài khoản? Đăng ký",
            },
          },
        }}
      />
    </div>
  );
}
