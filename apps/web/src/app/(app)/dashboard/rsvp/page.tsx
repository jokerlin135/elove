"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";

// TODO: Replace with actual project picker when multi-project is supported
const ACTIVE_PROJECT_ID = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("projectId") ?? ""
    : "";

export default function RsvpPage() {
    const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
    const [projectId] = useState(ACTIVE_PROJECT_ID);

    const stats = trpc.guests.rsvpStats.useQuery(
        { projectId },
        { enabled: !!projectId },
    );
    const rsvpList = trpc.guests.listRsvp.useQuery(
        { projectId },
        { enabled: !!projectId },
    );

    const data = (rsvpList.data ?? []).filter((r) => {
        if (filter === "yes") return r.attending;
        if (filter === "no") return !r.attending;
        return true;
    });

    const s = stats.data ?? { total: 0, attending: 0, declined: 0, totalGuests: 0 };

    if (!projectId) {
        return (
            <div className="p-8 max-w-4xl">
                <h1 className="text-2xl font-bold text-white mb-6">Quản lý RSVP</h1>
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-white/30 text-lg mb-2">Chọn thiệp để xem RSVP</p>
                    <p className="text-white/20 text-sm">Mở thiệp từ trang "Thiệp của tôi" để quản lý RSVP.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl">
            <h1 className="text-2xl font-bold text-white mb-6">Quản lý RSVP</h1>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <StatCard label="Tổng phản hồi" value={s.total} />
                <StatCard label="Tham dự" value={s.attending} sublabel={`${s.totalGuests} khách`} accent="emerald" />
                <StatCard label="Từ chối" value={s.declined} accent="rose" />
            </div>

            {/* Filter */}
            <div className="flex gap-2 mb-6">
                {(["all", "yes", "no"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-white/5 text-white/50 border border-white/8 hover:border-white/15"
                            }`}
                    >
                        {f === "all" ? "Tất cả" : f === "yes" ? "Tham dự" : "Từ chối"}
                    </button>
                ))}
            </div>

            {/* Table */}
            {rsvpList.isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                    ))}
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-white/30 text-lg mb-2">Chưa có phản hồi RSVP</p>
                    <p className="text-white/20 text-sm">
                        Khi khách mời xác nhận qua thiệp online, phản hồi sẽ hiện ở đây.
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/8 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-white/[0.03] text-white/40">
                                <th className="text-left py-3 px-4 font-medium">Tên khách</th>
                                <th className="text-left py-3 px-4 font-medium">Email</th>
                                <th className="text-center py-3 px-4 font-medium">Tham dự</th>
                                <th className="text-center py-3 px-4 font-medium">Số khách</th>
                                <th className="text-left py-3 px-4 font-medium">Ghi chú</th>
                                <th className="text-left py-3 px-4 font-medium">Ngày</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((r) => (
                                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-4 text-white">{r.guestName}</td>
                                    <td className="py-3 px-4 text-white/40">{r.email ?? "—"}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.attending
                                                    ? "bg-emerald-500/15 text-emerald-400"
                                                    : "bg-rose-500/15 text-rose-400"
                                                }`}
                                        >
                                            {r.attending ? "Có" : "Không"}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-white/60">{r.partySize}</td>
                                    <td className="py-3 px-4 text-white/40 truncate max-w-[150px]">
                                        {r.dietaryNotes ?? "—"}
                                    </td>
                                    <td className="py-3 px-4 text-white/30 text-xs">
                                        {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    sublabel,
    accent,
}: {
    label: string;
    value: number;
    sublabel?: string;
    accent?: string;
}) {
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
            <div className="text-xs text-white/40 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "text-white"}`}>
                {value}
            </div>
            {sublabel && <div className="text-xs text-white/30 mt-0.5">{sublabel}</div>}
        </div>
    );
}
