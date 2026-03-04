import React from "react";

interface AccountDeactivatedEmailProps {
  userName: string;
  reason: string;
}

export function AccountDeactivatedEmail({ userName, reason }: AccountDeactivatedEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2 style={{ color: "#555" }}>Tài khoản đã bị vô hiệu hóa</h2>
        <p>Chào {userName},</p>
        <p>Tài khoản ELove của bạn đã bị vô hiệu hóa.</p>
        <p>
          <strong>Lý do:</strong> {reason}
        </p>
        <p>
          Nếu bạn cho rằng đây là nhầm lẫn hoặc muốn khiếu nại, vui lòng liên hệ với chúng tôi.
        </p>
        <p>
          <a
            href="mailto:support@elove.me"
            style={{
              background: "#555",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Liên hệ hỗ trợ
          </a>
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Đây là email tự động từ hệ thống ELove. Vui lòng không trả lời email này.
        </p>
      </body>
    </html>
  );
}
