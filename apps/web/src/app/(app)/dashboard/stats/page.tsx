"use client";

import { trpc } from "../../../../lib/trpc";

const ACTIVE_PROJECT_ID = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("projectId") ?? ""
    : "";

export default function StatsPage() {
    const stats = trpc.guests.dashboardStats.useQuery(
        { projectId: ACTIVE_PROJECT_ID },
        { enabled: !!ACTIVE_PROJECT_ID },
    );

    const s = stats.data ?? {
        rsvpCount: 0,
        attendingCount: 0,
        totalGuests: 0,
        wishCount: 0,
        giftCount: 0,
        giftTotal: 0,
    };

    if (!ACTIVE_PROJECT_ID) {
        return (
            <div className="p-8 max-w-4xl">
                <h1 className="text-2xl font-bold text-white mb-6">Thống kê</h1>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-8 text-center">
                    <p className="text-4xl mb-4 opacity-20">📊</p>
                    <p className="text-white/30 text-lg mb-2">Chọn thiệp để xem thống kê</p>
                    <p className="text-white/20 text-sm">Mở thiệp từ trang "Thiệp của tôi" để xem thống kê.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl">
            <h1 className="text-2xl font-bold text-white mb-6">Thống kê</h1>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard label="RSVP" value={String(s.rsvpCount)} icon="📋" />
                <StatCard label="Tham dự" value={`${s.attendingCount} (${s.totalGuests} khách)`} icon="✅" accent="emerald" />
                <StatCard label="Lời chúc" value={String(s.wishCount)} icon="💌" />
                <StatCard label="Quà tặng" value={`${s.giftTotal.toLocaleString("vi-VN")}₫`} icon="🎁" accent="rose" />
                <StatCard label="Lượt gửi quà" value={String(s.giftCount)} icon="📦" />
            </div>

            {/* Summary */}
            {stats.isLoading ? (
                <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
            ) : s.rsvpCount === 0 && s.wishCount === 0 && s.giftCount === 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-8 text-center">
                    <p className="text-4xl mb-4 opacity-20">📊</p>
                    <p className="text-white/30 text-lg mb-2">Chưa có dữ liệu thống kê</p>
                    <p className="text-white/20 text-sm max-w-md mx-auto">
                        Chia sẻ thiệp để khách mời RSVP, gửi lời chúc, và tặng quà.
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl bg-gradient-to-r from-rose-500/5 to-pink-600/5 border border-rose-500/15 p-6">
                    <h2 className="text-sm font-semibold text-white/60 mb-3">Tóm tắt</h2>
                    <p className="text-sm text-white/50 leading-relaxed">
                        Thiệp của bạn đã nhận được <strong className="text-white">{s.rsvpCount}</strong> phản hồi RSVP
                        ({s.attendingCount} tham dự, tổng {s.totalGuests} khách),{" "}
                        <strong className="text-white">{s.wishCount}</strong> lời chúc, và{" "}
                        <strong className="text-white">{s.giftCount}</strong> món quà
                        (tổng giá trị <strong className="text-rose-400">{s.giftTotal.toLocaleString("vi-VN")}₫</strong>).
                    </p>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    accent,
}: {
    label: string;
    value: string;
    icon: string;
    accent?: string;
}) {
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
                <span>{icon}</span>
                {label}
            </div>
            <div className={`text-xl font-bold ${accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "text-white"}`}>
                {value}
            </div>
        </div>
    );
}
