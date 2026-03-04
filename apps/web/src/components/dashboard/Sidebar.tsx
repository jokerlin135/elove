"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Thiệp của tôi", icon: "♡" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/dashboard/settings", label: "Cài đặt", icon: "⚙" },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-56 min-h-screen bg-[#0d0d1a] border-r border-white/5 flex flex-col">
      <div className="p-5">
        <span className="text-xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
          ELove
        </span>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
              pathname === item.href
                ? "bg-rose-500/15 text-rose-300"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
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
