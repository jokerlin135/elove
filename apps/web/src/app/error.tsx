"use client";

import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen bg-[#080810] text-white flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
                <div className="text-6xl mb-6">⚠️</div>

                <h1 className="text-2xl font-bold mb-3">Đã xảy ra lỗi</h1>
                <p className="text-sm text-white/40 mb-2">
                    Chúng tôi đang khắc phục sự cố. Vui lòng thử lại.
                </p>

                {error.digest && (
                    <p className="text-xs text-white/20 font-mono mb-6">
                        Mã lỗi: {error.digest}
                    </p>
                )}

                <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                        onClick={reset}
                        className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        Thử lại
                    </button>
                    <Link
                        href="/"
                        className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm hover:bg-white/10 transition-colors"
                    >
                        Về trang chủ
                    </Link>
                </div>
            </div>
        </div>
    );
}
