"use client";

import { trpc } from "../../../../lib/trpc";

const ACTIVE_PROJECT_ID = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("projectId") ?? ""
    : "";

export default function WishesPage() {
    const wishes = trpc.guests.listWishes.useQuery(
        { projectId: ACTIVE_PROJECT_ID },
        { enabled: !!ACTIVE_PROJECT_ID },
    );
    const approve = trpc.guests.approveWish.useMutation();

    const data = wishes.data ?? [];

    if (!ACTIVE_PROJECT_ID) {
        return (
            <div className="p-8 max-w-3xl">
                <h1 className="text-2xl font-bold text-white mb-6">Lời chúc</h1>
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-4xl mb-4 opacity-20">💌</p>
                    <p className="text-white/30 text-lg mb-2">Chọn thiệp để xem lời chúc</p>
                    <p className="text-white/20 text-sm">Mở thiệp từ trang "Thiệp của tôi" để quản lý lời chúc.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl">
            <h1 className="text-2xl font-bold text-white mb-6">
                Lời chúc
                {data.length > 0 && (
                    <span className="ml-2 text-base text-white/30 font-normal">({data.length})</span>
                )}
            </h1>

            {wishes.isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                    <p className="text-4xl mb-4 opacity-20">💌</p>
                    <p className="text-white/30 text-lg mb-2">Chưa có lời chúc nào</p>
                    <p className="text-white/20 text-sm">
                        Khi khách mời gửi lời chúc qua thiệp online, chúng sẽ hiện ở đây.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {data.map((w) => (
                        <div
                            key={w.id}
                            className={`rounded-2xl border p-5 transition-colors ${w.isApproved
                                    ? "bg-white/[0.03] border-white/8 hover:border-white/15"
                                    : "bg-rose-500/5 border-rose-500/20"
                                }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-white">{w.guestName}</span>
                                <div className="flex items-center gap-3">
                                    {!w.isApproved && (
                                        <button
                                            onClick={async () => {
                                                await approve.mutateAsync({ wishId: w.id, approved: true });
                                                wishes.refetch();
                                            }}
                                            className="text-xs text-emerald-400 hover:underline"
                                        >
                                            Duyệt
                                        </button>
                                    )}
                                    <span className="text-xs text-white/30">
                                        {new Date(w.createdAt).toLocaleDateString("vi-VN")}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-white/60 leading-relaxed">{w.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
