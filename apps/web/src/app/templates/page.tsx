import { TRPCProvider } from "../../components/TRPCProvider";
import { TemplateGallery } from "../../components/templates/TemplateGallery";
import Link from "next/link";

export const metadata = {
    title: "Mẫu thiệp online — ELove",
    description: "Khám phá bộ sưu tập mẫu thiệp online đẹp: thiệp cưới, sinh nhật, sự kiện, kỷ niệm. Tạo miễn phí ngay hôm nay.",
};

export default function TemplatesPage() {
    return (
        <div className="min-h-screen bg-[#080810] text-white">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#080810]/80 backdrop-blur-md border-b border-white/5">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
                        ELove
                    </span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        href="/pricing"
                        className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                    >
                        Gói dịch vụ
                    </Link>
                    <Link
                        href="/login"
                        className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                    >
                        Đăng nhập
                    </Link>
                    <Link
                        href="/signup"
                        className="px-4 py-2 text-sm bg-gradient-to-r from-rose-500 to-pink-600 rounded-full font-medium hover:opacity-90 transition-opacity"
                    >
                        Bắt đầu miễn phí
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <section className="relative pt-28 pb-16 px-6">
                <div className="absolute top-20 left-1/4 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-40 right-1/4 w-48 h-48 bg-pink-600/8 rounded-full blur-3xl pointer-events-none" />

                <div className="relative max-w-6xl mx-auto">
                    <TRPCProvider>
                        <TemplateGallery />
                    </TRPCProvider>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-white/5">
                <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-white/30">
                    <span className="font-semibold text-white/60">
                        ELove <span className="text-rose-400">♡</span>
                    </span>
                    <span>© 2026 ELove. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}
