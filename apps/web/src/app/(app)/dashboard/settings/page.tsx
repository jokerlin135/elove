"use client";

import { useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

export default function SettingsPage() {
  const [tab, setTab] = useState<"profile" | "security" | "domain">("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Custom domain
  const [domain, setDomain] = useState("");
  const [domainStatus, setDomainStatus] = useState<string | null>(null);

  async function handleSaveProfile() {
    setSaving(true);
    const supabase = createClient();
    await supabase.auth.updateUser({
      data: { display_name: displayName, phone },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAddDomain() {
    if (!domain) return;
    setSaving(true);
    setDomainStatus("pending");
    // TODO: Call tRPC to add custom domain
    await new Promise((r) => setTimeout(r, 1000));
    setDomainStatus("pending");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const TABS = [
    { key: "profile" as const, label: "Hồ sơ", icon: "👤" },
    { key: "security" as const, label: "Bảo mật", icon: "🔒" },
    { key: "domain" as const, label: "Tên miền", icon: "🌐" },
  ];

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Cài đặt</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 bg-white/[0.03] rounded-xl border border-white/5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === t.key
                ? "bg-rose-500/15 text-rose-300"
                : "text-white/40 hover:text-white/60"
              }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Success Toast */}
      {saved && (
        <div className="mb-4 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-sm text-emerald-400">
          ✓ Đã lưu thay đổi
        </div>
      )}

      {/* Profile Tab */}
      {tab === "profile" && (
        <div className="space-y-5">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <div className="space-y-5">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Xác nhận mật khẩu</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-rose-400 mt-1">Mật khẩu không khớp</p>
            )}
          </div>
          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || newPassword !== confirmPassword}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? "Đang cập nhật..." : "Đổi mật khẩu"}
          </button>
        </div>
      )}

      {/* Custom Domain Tab */}
      {tab === "domain" && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/15 text-sm">
            <p className="text-white/60 mb-1">
              <strong className="text-rose-300">Pro</strong> — Tính năng dành cho gói Pro trở lên
            </p>
            <p className="text-white/40 text-xs">
              Kết nối tên miền riêng để thiệp cưới của bạn hiển thị tại domain.com thay vì elove.me/slug
            </p>
          </div>

          <div>
            <label className="text-xs text-white/40 block mb-1.5">Tên miền</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="wedding.yourdomain.com"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50"
              />
              <button
                onClick={handleAddDomain}
                disabled={saving || !domain}
                className="px-5 py-3 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {saving ? "..." : "Thêm"}
              </button>
            </div>
          </div>

          {domainStatus && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white font-medium">{domain}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${domainStatus === "active"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : domainStatus === "pending"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-rose-500/15 text-rose-400"
                  }`}>
                  {domainStatus === "active" ? "Hoạt động" : domainStatus === "pending" ? "Đang xác minh" : "Lỗi"}
                </span>
              </div>
              <div className="text-xs text-white/30 space-y-1">
                <p>Thêm bản ghi CNAME vào DNS của bạn:</p>
                <div className="bg-white/5 rounded-lg p-3 font-mono text-white/50">
                  <p>Type: CNAME</p>
                  <p>Name: {domain.split(".")[0]}</p>
                  <p>Value: proxy.elove.me</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
