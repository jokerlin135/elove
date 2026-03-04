import React from "react";

interface PaymentFailedEmailProps {
  userName: string;
  amount: string;
  updatePaymentUrl: string;
}

export function PaymentFailedEmail({ userName, amount, updatePaymentUrl }: PaymentFailedEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "0 auto" }}>
        <h2 style={{ color: "#d32f2f" }}>Thanh toán thất bại</h2>
        <p>Chào {userName},</p>
        <p>
          Chúng tôi không thể xử lý khoản thanh toán <strong>{amount}</strong> của bạn.
        </p>
        <p>
          Vui lòng cập nhật thông tin thanh toán để tiếp tục sử dụng dịch vụ ELove.
        </p>
        <p>
          <a
            href={updatePaymentUrl}
            style={{
              background: "#d32f2f",
              color: "white",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            Cập nhật thông tin thanh toán
          </a>
        </p>
        <p style={{ color: "#666", fontSize: "12px" }}>
          Nếu bạn cần hỗ trợ, vui lòng liên hệ support@elove.me.
        </p>
      </body>
    </html>
  );
}
