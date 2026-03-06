"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../lib/trpc";

const TYPE_ICONS: Record<string, string> = {
    rsvp: "✉️",
    wish: "💌",
    gift: "🎁",
};

const TYPE_COLORS: Record<string, string> = {
    rsvp: "bg-emerald-500/15 text-emerald-400",
    wish: "bg-rose-500/15 text-rose-300",
    gift: "bg-amber-500/15 text-amber-400",
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
}

export function NotificationPanel() {
    const [open, setOpen] = useState(false);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    const { data: activities } = trpc.guests.recentActivity.useQuery(undefined, {
        refetchInterval: 30000, // Refresh every 30s
        refetchOnWindowFocus: true,
    });

    const items = activities ?? [];
    const unreadCount = items.filter((n) => !readIds.has(n.id)).length;

    function markAllRead() {
        setReadIds(new Set(items.map((n) => n.id)));
    }

    function markRead(id: string) {
        setReadIds((prev) => new Set([...prev, id]));
    }

    // Close on click outside
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-notification-panel]")) {
                setOpen(false);
            }
        }
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [open]);

    return (
        <div className="relative" data-notification-panel>
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 text-white/40 hover:text-white transition-colors"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-medium">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d0d1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <span className="text-sm font-medium text-white">Thông báo</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-xs text-rose-400 hover:text-rose-300"
                            >
                                Đánh dấu tất cả đã đọc
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-72 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="py-8 text-center text-white/20 text-sm">
                                Chưa có thông báo nào
                            </div>
                        ) : (
                            items.map((n) => {
                                const isUnread = !readIds.has(n.id);
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => markRead(n.id)}
                                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors ${isUnread ? "bg-white/[0.01]" : ""
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${TYPE_COLORS[n.type]}`}>
                                            {TYPE_ICONS[n.type]}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium ${isUnread ? "text-white" : "text-white/60"}`}>
                                                    {n.title}
                                                </span>
                                                {isUnread && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-white/40 truncate">{n.message}</p>
                                            <p className="text-[10px] text-white/20 mt-0.5">{timeAgo(n.time)}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
