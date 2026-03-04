"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "../../../lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <Auth
        supabaseClient={supabase}
        appearance={{
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
        }}
        providers={["google"]}
        redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`}
        view="sign_up"
        localization={{
          variables: {
            sign_up: {
              email_label: "Email",
              password_label: "Mật khẩu",
              button_label: "Đăng ký",
              social_provider_text: "Đăng ký với {{provider}}",
              link_text: "Đã có tài khoản? Đăng nhập",
            },
          },
        }}
      />
    </div>
  );
}
