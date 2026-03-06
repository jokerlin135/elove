import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#080810] text-white flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
                {/* Animated heart */}
                <div className="text-7xl mb-6 animate-pulse">💔</div>

                <h1 className="text-4xl font-bold mb-3">404</h1>
                <h2 className="text-lg text-white/60 mb-2">Trang không tồn tại</h2>
                <p className="text-sm text-white/30 mb-8">
                    Có thể thiệp cưới này đã hết hạn hoặc link không đúng.
                </p>

                <div className="flex items-center justify-center gap-3">
                    <Link
                        href="/"
                        className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        Về trang chủ
                    </Link>
                    <Link
                        href="/templates"
                        className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm hover:bg-white/10 transition-colors"
                    >
                        Xem mẫu thiệp
                    </Link>
                </div>
            </div>
        </div>
    );
}
