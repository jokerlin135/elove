import React from "react";

interface TrialEndingEmailProps {
  userName: string;
  daysLeft: number;
  upgradeUrl: string;
}

export function TrialEndingEmail({ userName, daysLeft, upgradeUrl }: TrialEndingEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Gói dùng thử của bạn sắp hết hạn</h2>
        <p>Chào {userName},</p>
        <p>
          Gói dùng thử của bạn còn <strong>{daysLeft} ngày</strong>.
        </p>
        <p>Đừng để mất những tính năng cao cấp bạn đang sử dụng. Nâng cấp ngay hôm nay để tiếp tục trải nghiệm ELove.</p>
        <p>
          <a
            href={upgradeUrl}
            style={{
              background: "#e91e8c",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Nâng cấp ngay
          </a>
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi qua email support@elove.me.
        </p>
      </body>
    </html>
  );
}
