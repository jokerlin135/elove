import type { Metadata, Viewport } from "next";
import { Analytics } from "../components/Analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ELove — Thiệp Cưới Online Đẹp Nhất Việt Nam",
    template: "%s | ELove",
  },
  description: "Tạo thiệp cưới online đẹp, cá nhân hoá và chia sẻ dễ dàng. Miễn phí để bắt đầu. RSVP, lời chúc, quà trực tuyến.",
  keywords: ["thiệp cưới online", "wedding invitation", "thiệp cưới đẹp", "elove", "thiệp mời cưới"],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "ELove",
    title: "ELove — Thiệp Cưới Online",
    description: "Tạo thiệp cưới online đẹp, cá nhân hoá và chia sẻ dễ dàng.",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://elove.me"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080810",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
