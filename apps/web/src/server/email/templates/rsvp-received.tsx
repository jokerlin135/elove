import React from "react";

interface RsvpReceivedEmailProps {
  hostName: string;
  guestName: string;
  attending: boolean;
  partySize: number;
  projectUrl: string;
}

export function RsvpReceivedEmail({
  hostName,
  guestName,
  attending,
  partySize,
  projectUrl,
}: RsvpReceivedEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Khách mời mới xác nhận tham dự!</h2>
        <p>Chào {hostName},</p>
        <p>
          <strong>{guestName}</strong> vừa {attending ? "xác nhận tham dự" : "từ chối tham dự"} tiệc cưới của bạn.
        </p>
        {attending && (
          <p>
            Số lượng: <strong>{partySize} người</strong>
          </p>
        )}
        <p>
          <a
            href={projectUrl}
            style={{
              background: "#e91e8c",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Xem danh sách khách mời
          </a>
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Email này được gửi tự động từ hệ thống ELove.
        </p>
      </body>
    </html>
  );
}
