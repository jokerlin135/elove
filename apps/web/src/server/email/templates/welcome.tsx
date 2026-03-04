import React from "react";

interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
}

export function WelcomeEmail({ userName, loginUrl }: WelcomeEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Chào mừng {userName}! 🎉</h1>
        <p>Cảm ơn bạn đã đăng ký ELove — nền tảng thiệp cưới online của bạn.</p>
        <p>
          <a
            href={loginUrl}
            style={{
              background: "#e91e8c",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Bắt đầu ngay
          </a>
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
        </p>
      </body>
    </html>
  );
}
