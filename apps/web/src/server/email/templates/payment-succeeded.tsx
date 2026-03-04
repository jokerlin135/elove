import React from "react";

interface PaymentSucceededEmailProps {
  userName: string;
  planName: string;
  amount: string;
}

export function PaymentSucceededEmail({ userName, planName, amount }: PaymentSucceededEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2 style={{ color: "#2e7d32" }}>Thanh toán thành công!</h2>
        <p>Chào {userName},</p>
        <p>
          Khoản thanh toán của bạn đã được xử lý thành công.
        </p>
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "16px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", color: "#666" }}>Gói dịch vụ</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", fontWeight: "bold" }}>{planName}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px", color: "#666" }}>Số tiền</td>
              <td style={{ padding: "8px", fontWeight: "bold" }}>{amount}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: "24px" }}>
          Cảm ơn bạn đã tin tưởng ELove. Chúc bạn có đám cưới thật đẹp!
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Đây là email xác nhận tự động. Vui lòng giữ lại để làm biên lai.
        </p>
      </body>
    </html>
  );
}
