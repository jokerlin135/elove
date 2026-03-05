import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELove — Thiệp Cưới Online",
  description: "Tạo thiệp cưới đẹp, chia sẻ dễ dàng",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
