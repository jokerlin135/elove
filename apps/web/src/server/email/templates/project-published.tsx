import React from "react";

interface ProjectPublishedEmailProps {
  userName: string;
  projectTitle: string;
  siteUrl: string;
}

export function ProjectPublishedEmail({ userName, projectTitle, siteUrl }: ProjectPublishedEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Thiệp cưới đã được phát hành!</h2>
        <p>Chào {userName},</p>
        <p>
          Thiệp cưới <strong>"{projectTitle}"</strong> của bạn đã được phát hành thành công.
        </p>
        <p>Chia sẻ đường dẫn này với khách mời của bạn:</p>
        <p
          style={{
            background: "#f5f5f5",
            padding: "12px",
            borderRadius: "6px",
            wordBreak: "break-all",
            fontSize: "14px",
          }}
        >
          {siteUrl}
        </p>
        <p>
          <a
            href={siteUrl}
            style={{
              background: "#e91e8c",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Xem thiệp cưới
          </a>
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Chúc mừng hạnh phúc! — Đội ngũ ELove
        </p>
      </body>
    </html>
  );
}
