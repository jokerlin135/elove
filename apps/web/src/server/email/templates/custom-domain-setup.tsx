import React from "react";

interface CustomDomainSetupEmailProps {
  userName: string;
  customDomain: string;
  cnameTarget: string;
}

export function CustomDomainSetupEmail({ userName, customDomain, cnameTarget }: CustomDomainSetupEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Hướng dẫn cài đặt tên miền</h2>
        <p>Chào {userName},</p>
        <p>
          Để kết nối tên miền <strong>{customDomain}</strong> với ELove, vui lòng thêm bản ghi DNS sau:
        </p>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            marginTop: "16px",
            border: "1px solid #ddd",
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Loại</th>
              <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Tên</th>
              <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Giá trị</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>CNAME</td>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>{customDomain}</td>
              <td style={{ padding: "10px", border: "1px solid #ddd", wordBreak: "break-all" }}>{cnameTarget}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: "16px" }}>
          Sau khi thêm bản ghi DNS, việc truyền bá có thể mất từ 24 đến 48 giờ.
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Nếu bạn cần hỗ trợ, vui lòng liên hệ support@elove.me.
        </p>
      </body>
    </html>
  );
}
