"use client";
import dynamic from "next/dynamic";
import { createClient } from "../../../lib/supabase/client";

const Auth = dynamic(
  () => import("@supabase/auth-ui-react").then((m) => m.Auth),
  { ssr: false }
);

const appearance = {
  theme: undefined as any,
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
};

export default function SignupPage() {
  const supabase = createClient();
  const { ThemeSupa } = require("@supabase/auth-ui-shared");
  appearance.theme = ThemeSupa;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <Auth
        supabaseClient={supabase}
        appearance={appearance}
        providers={[]}
        redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://elove-xi.vercel.app"}/auth/callback`}
        view="sign_up"
        localization={{
          variables: {
            sign_up: {
              email_label: "Email",
              password_label: "Mật khẩu",
              button_label: "Đăng ký miễn phí",
              link_text: "Đã có tài khoản? Đăng nhập",
            },
          },
        }}
      />
    </div>
  );
}
