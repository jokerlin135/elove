"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc";

type BillingCycle = "monthly" | "yearly" | "lifetime";

const PLAN_FEATURES: Record<string, string[]> = {
    free: ["1 trang thiệp", "10 hình ảnh", "300 lượt xem", "Mẫu cơ bản", "Watermark"],
    pro: ["5 trang thiệp", "100 hình ảnh", "Không giới hạn views", "Mẫu PREMIUM", "Không watermark", "Domain riêng"],
    lifetime: ["Không giới hạn", "Mẫu PREMIUM", "Hỗ trợ ưu tiên", "Truy cập sớm tính năng mới"],
};

const PRICES: Record<string, Record<string, string>> = {
    pro: { monthly: "150.000₫ / tháng", yearly: "1.500.000₫ / năm" },
    lifetime: { lifetime: "4.990.000₫ / trọn đời" },
};

export function BillingDashboard() {
    const subscription = trpc.billing.getSubscription.useQuery();
    const checkout = trpc.billing.createCheckoutLink.useMutation();
    const cancel = trpc.billing.cancelSubscription.useMutation();

    const [selectedPlan, setSelectedPlan] = useState<"pro" | "lifetime">("pro");
    const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const sub = subscription.data;
    const currentPlan = sub?.plan_id ?? "free";
    const isActive = sub?.status === "active" || sub?.status === "lifetime";

    async function handleUpgrade() {
        const cycle = selectedPlan === "lifetime" ? "lifetime" : billingCycle;
        const result = await checkout.mutateAsync({
            planId: selectedPlan,
            billingCycle: cycle,
        });
        window.location.href = result.checkoutUrl;
    }

    async function handleCancel() {
        await cancel.mutateAsync();
        setShowCancelConfirm(false);
        subscription.refetch();
    }

    return (
        <div className="p-8 max-w-3xl">
            <h1 className="text-2xl font-bold text-white mb-8">Gói dịch vụ</h1>

            {/* Current Plan Card */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Gói hiện tại</h2>
                        <p className="text-sm text-white/40 mt-1">
                            {subscription.isLoading ? "Đang tải..." : `Gói ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}`}
                        </p>
                    </div>
                    <StatusBadge status={sub?.status ?? "free"} />
                </div>

                {/* Usage Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <UsageStat label="Website" current={0} max={currentPlan === "free" ? 1 : currentPlan === "pro" ? 5 : "∞"} />
                    <UsageStat label="Hình ảnh" current={0} max={currentPlan === "free" ? 10 : currentPlan === "pro" ? 100 : "∞"} />
                    <UsageStat label="Lượt xem" current={0} max={currentPlan === "free" ? 300 : "∞"} />
                </div>

                {isActive && currentPlan !== "free" && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="text-xs text-white/30">
                            {sub?.current_period_end && `Hết hạn: ${new Date(sub.current_period_end).toLocaleDateString("vi-VN")}`}
                        </div>
                        <button
                            onClick={() => setShowCancelConfirm(true)}
                            className="text-xs text-rose-400/60 hover:text-rose-400 transition-colors"
                        >
                            Hủy gói
                        </button>
                    </div>
                )}
            </div>

            {/* Cancel Confirmation Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#12121f] border border-white/10 rounded-2xl p-6 max-w-sm mx-4">
                        <h3 className="text-lg font-bold text-white mb-2">Xác nhận hủy gói</h3>
                        <p className="text-sm text-white/50 mb-6">
                            Bạn sẽ vẫn sử dụng được đến hết chu kỳ thanh toán. Sau đó, tài khoản sẽ chuyển về gói Free.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors"
                            >
                                Giữ gói
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={cancel.isPending}
                                className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-sm font-medium text-rose-300 hover:bg-rose-500/30 transition-colors disabled:opacity-50"
                            >
                                {cancel.isPending ? "Đang hủy..." : "Xác nhận hủy"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Section */}
            {(!isActive || currentPlan === "free") && (
                <div className="rounded-2xl bg-gradient-to-br from-rose-500/5 to-pink-600/5 border border-rose-500/20 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Nâng cấp</h2>

                    {/* Plan Toggle */}
                    <div className="flex gap-2 mb-5">
                        {(["pro", "lifetime"] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => {
                                    setSelectedPlan(p);
                                    if (p === "lifetime") setBillingCycle("lifetime");
                                    else setBillingCycle("monthly");
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedPlan === p
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                        : "bg-white/5 text-white/50 border border-white/8 hover:border-white/15"
                                    }`}
                            >
                                {p === "pro" ? "Pro" : "Lifetime"}
                            </button>
                        ))}
                    </div>

                    {/* Billing Cycle Toggle (Pro only) */}
                    {selectedPlan === "pro" && (
                        <div className="flex gap-2 mb-5">
                            {(["monthly", "yearly"] as const).map((cycle) => (
                                <button
                                    key={cycle}
                                    onClick={() => setBillingCycle(cycle)}
                                    className={`px-4 py-2 rounded-xl text-sm transition-all ${billingCycle === cycle
                                            ? "bg-white/10 text-white border border-white/15"
                                            : "bg-white/[0.03] text-white/40 border border-white/5 hover:text-white/60"
                                        }`}
                                >
                                    {cycle === "monthly" ? "Hàng tháng" : "Hàng năm"}
                                    {cycle === "yearly" && (
                                        <span className="ml-1.5 text-xs text-emerald-400">-17%</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Price Display */}
                    <div className="mb-5">
                        <span className="text-2xl font-bold text-white">
                            {PRICES[selectedPlan]?.[billingCycle] ?? ""}
                        </span>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                        {(PLAN_FEATURES[selectedPlan] ?? []).map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                                <span className="text-rose-400 text-xs">✓</span>
                                {f}
                            </li>
                        ))}
                    </ul>

                    {/* Checkout Button */}
                    <button
                        onClick={handleUpgrade}
                        disabled={checkout.isPending}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/25 disabled:opacity-50"
                    >
                        {checkout.isPending
                            ? "Đang tạo liên kết thanh toán..."
                            : `Nâng cấp ${selectedPlan === "pro" ? "Pro" : "Lifetime"}`}
                    </button>

                    {checkout.error && (
                        <p className="mt-3 text-xs text-rose-400 text-center">
                            {checkout.error.message}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        free: { label: "Free", className: "bg-white/10 text-white/50" },
        active: { label: "Đang hoạt động", className: "bg-emerald-500/15 text-emerald-400" },
        lifetime: { label: "Lifetime", className: "bg-amber-500/15 text-amber-400" },
        canceled: { label: "Đã hủy", className: "bg-rose-500/15 text-rose-400" },
    };
    const c = config[status] ?? config.free;
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.className}`}>
            {c.label}
        </span>
    );
}

function UsageStat({
    label,
    current,
    max,
}: {
    label: string;
    current: number;
    max: number | string;
}) {
    const isUnlimited = max === "∞";
    const pct = isUnlimited ? 0 : (current / (max as number)) * 100;

    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
            <div className="text-xs text-white/40 mb-2">{label}</div>
            <div className="text-lg font-bold text-white">
                {current} / {max}
            </div>
            {!isUnlimited && (
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${pct > 80 ? "bg-rose-500" : "bg-rose-400/50"
                            }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}
