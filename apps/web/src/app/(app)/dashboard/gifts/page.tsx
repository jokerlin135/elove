"use client";

import { trpc } from "../../../../lib/trpc";

const ACTIVE_PROJECT_ID = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("projectId") ?? ""
    : "";

export default function GiftsPage() {
    const gifts = trpc.guests.listGifts.useQuery(
        { projectId: ACTIVE_PROJECT_ID },
        { enabled: !!ACTIVE_PROJECT_ID },
    );
    const stats = trpc.guests.giftStats.useQuery(
        { projectId: ACTIVE_PROJECT_ID },
        { enabled: !!ACTIVE_PROJECT_ID },
    );

    const data = gifts.data ?? [];
    const total = stats.data?.totalAmount ?? 0;
    const count = stats.data?.count ?? 0;

    if (!ACTIVE_PROJECT_ID) {
        return (
            <div className="p-8 max-w-3xl">
                <h1 className="text-2xl font-bold text-white mb-6">Quà tặng</h1>
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-4xl mb-4 opacity-20">🎁</p>
                    <p className="text-white/30 text-lg mb-2">Chọn thiệp để xem quà tặng</p>
                    <p className="text-white/20 text-sm">Mở thiệp từ trang "Thiệp của tôi" để quản lý quà.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl">
            <h1 className="text-2xl font-bold text-white mb-6">Quà tặng</h1>

            {/* Total */}
            <div className="rounded-xl bg-gradient-to-r from-rose-500/10 to-pink-600/10 border border-rose-500/20 p-5 mb-8">
                <div className="text-sm text-white/40 mb-1">Tổng quà nhận được</div>
                <div className="text-3xl font-bold text-white">
                    {total.toLocaleString("vi-VN")}₫
                </div>
                <div className="text-xs text-white/30 mt-1">{count} lượt gửi</div>
            </div>

            {gifts.isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-4xl mb-4 opacity-20">🎁</p>
                    <p className="text-white/30 text-lg mb-2">Chưa có quà nào</p>
                    <p className="text-white/20 text-sm">
                        Khi khách mời gửi quà qua thiệp online, quà sẽ hiện ở đây.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {data.map((g) => (
                        <div
                            key={g.id}
                            className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 hover:border-white/15 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-white">{g.guestName}</span>
                                <span className="text-lg font-bold text-rose-400">
                                    {g.amount.toLocaleString("vi-VN")}₫
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-white/30">
                                    {g.method === "bank_transfer" ? "Chuyển khoản" : g.method === "momo" ? "MoMo" : "Tiền mặt"} • {new Date(g.createdAt).toLocaleDateString("vi-VN")}
                                </span>
                                {g.message && (
                                    <span className="text-sm text-white/50 truncate max-w-[200px]">
                                        &quot;{g.message}&quot;
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
