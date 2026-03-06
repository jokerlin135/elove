"use client";

import { trpc } from "../../../lib/trpc";
import { ProjectGrid } from "../../../components/dashboard/ProjectGrid";

export default function DashboardPage() {
  const stats = trpc.guests.allStats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const s = stats.data;

  return (
    <div className="p-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Thiệp của tôi</h1>
        <p className="text-white/40 text-sm">
          Quản lý thiệp cưới, theo dõi RSVP và lời chúc từ khách mời.
        </p>
      </div>

      {/* Real Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Thiệp đã tạo", value: s?.projectCount ?? 0, icon: "♡", accent: "text-rose-400" },
          { label: "RSVP xác nhận", value: s?.rsvpCount ?? 0, icon: "✉️", accent: "text-emerald-400" },
          { label: "Lời chúc", value: s?.wishCount ?? 0, icon: "💌", accent: "text-amber-400" },
          { label: "Quà mừng", value: s?.giftCount ?? 0, icon: "🎁", accent: "text-blue-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-xl bg-white/[0.03] border border-white/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{stat.icon}</span>
              <span className="text-xs text-white/30">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold ${stat.accent}`}>
              {stats.isLoading ? (
                <span className="inline-block w-8 h-5 bg-white/5 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </div>
          </div>
        ))}
      </div>

      <ProjectGrid />
    </div>
  );
}
