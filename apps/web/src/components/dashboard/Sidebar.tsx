"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { NotificationPanel } from "./NotificationPanel";

type NavGroup = {
  title: string;
  items: { href: string; label: string; icon: string }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Thiệp",
    items: [
      { href: "/dashboard", label: "Thiệp của tôi", icon: "♡" },
      { href: "/templates", label: "Mẫu thiệp", icon: "🎨" },
    ],
  },
  {
    title: "Quản lý khách",
    items: [
      { href: "/dashboard/rsvp", label: "RSVP", icon: "📋" },
      { href: "/dashboard/wishes", label: "Lời chúc", icon: "💌" },
      { href: "/dashboard/gifts", label: "Quà tặng", icon: "🎁" },
    ],
  },
  {
    title: "Tài khoản",
    items: [
      { href: "/dashboard/billing", label: "Gói dịch vụ", icon: "💳" },
      { href: "/dashboard/stats", label: "Thống kê", icon: "📊" },
      { href: "/dashboard/settings", label: "Cài đặt", icon: "⚙" },
    ],
  },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-60 min-h-screen bg-[#0d0d1a] border-r border-white/5 flex flex-col">
      <div className="p-5 flex items-center justify-between">
        <Link href="/dashboard">
          <span className="text-xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
            ELove
          </span>
        </Link>
        <NotificationPanel />
      </div>

      <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/20">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${isActive(item.href)
                    ? "bg-rose-500/15 text-rose-300"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                >
                  <span className="w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="text-xs text-white/40 truncate mb-2">{email}</div>
        <button
          onClick={handleSignOut}
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
