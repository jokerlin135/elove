import Link from "next/link";

const PLANS = [
    {
        id: "free" as const,
        name: "Free",
        tagline: "Bắt đầu miễn phí",
        price: "0₫",
        period: "",
        features: [
            "1 trang thiệp",
            "10 hình ảnh",
            "300 lượt xem",
            "Mẫu cơ bản (BASIC)",
            "Chia sẻ qua link",
            "RSVP cơ bản",
            "Watermark ELove",
            "Lưu trữ 6 tháng",
        ],
        cta: "Bắt đầu ngay",
        href: "/signup",
        highlight: false,
    },
    {
        id: "pro" as const,
        name: "Pro",
        tagline: "Được yêu thích nhất",
        monthlyPrice: "150.000₫",
        yearlyPrice: "1.500.000₫",
        yearlySaving: "Tiết kiệm 300.000₫",
        features: [
            "5 trang thiệp",
            "100 hình ảnh",
            "Lượt xem không giới hạn",
            "Tất cả mẫu PREMIUM",
            "Không watermark",
            "Tên domain riêng",
            "Nhạc nền tùy chỉnh",
            "Thống kê chi tiết",
            "RSVP + Lời chúc + Quà tặng",
            "Lưu trữ vĩnh viễn",
        ],
        cta: "Nâng cấp Pro",
        href: "/signup",
        highlight: true,
    },
    {
        id: "lifetime" as const,
        name: "Lifetime",
        tagline: "Trọn đời, một lần duy nhất",
        price: "4.990.000₫",
        period: "/ trọn đời",
        features: [
            "Không giới hạn thiệp",
            "Không giới hạn hình ảnh",
            "Lượt xem không giới hạn",
            "Tất cả mẫu PREMIUM",
            "Không watermark",
            "Tên domain riêng",
            "Nhạc nền tùy chỉnh",
            "Thống kê chi tiết",
            "RSVP + Lời chúc + Quà tặng",
            "Lưu trữ vĩnh viễn",
            "Hỗ trợ ưu tiên",
            "Truy cập sớm tính năng mới",
        ],
        cta: "Mua Lifetime",
        href: "/signup",
        highlight: false,
    },
];

export const metadata = {
    title: "Gói dịch vụ — ELove",
    description: "So sánh các gói dịch vụ thiệp cưới online ELove. Bắt đầu miễn phí, nâng cấp khi cần.",
};

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#080810] text-white">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#080810]/80 backdrop-blur-md border-b border-white/5">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
                        ELove
                    </span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                    >
                        Trang chủ
                    </Link>
                    <Link
                        href="/login"
                        className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
                    >
                        Đăng nhập
                    </Link>
                    <Link
                        href="/signup"
                        className="px-4 py-2 text-sm bg-gradient-to-r from-rose-500 to-pink-600 rounded-full font-medium hover:opacity-90 transition-opacity"
                    >
                        Bắt đầu miễn phí
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-28 pb-8 px-6 text-center">
                <div className="absolute top-20 left-1/3 w-72 h-72 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-32 right-1/3 w-60 h-60 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Chọn gói phù hợp{" "}
                        <span className="bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
                            với bạn
                        </span>
                    </h1>
                    <p className="text-white/50 max-w-xl mx-auto">
                        Bắt đầu miễn phí, nâng cấp bất cứ lúc nào. Không ẩn phí. Hủy dễ dàng.
                    </p>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="px-6 pb-20">
                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5 items-start">
                    {PLANS.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative rounded-2xl p-6 border transition-all ${plan.highlight
                                ? "bg-gradient-to-br from-rose-500/10 to-pink-600/10 border-rose-500/40 shadow-lg shadow-rose-500/10 scale-[1.02] md:scale-105"
                                : "bg-white/[0.03] border-white/8 hover:border-white/15"
                                }`}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-xs font-semibold">
                                    Phổ biến nhất
                                </div>
                            )}

                            <div className="mb-5">
                                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                                <p className="text-sm text-white/40">{plan.tagline}</p>
                            </div>

                            {"monthlyPrice" in plan ? (
                                <ProPriceBlock
                                    monthlyPrice={(plan as { monthlyPrice: string }).monthlyPrice}
                                    yearlyPrice={(plan as { yearlyPrice: string }).yearlyPrice}
                                    yearlySaving={(plan as { yearlySaving: string }).yearlySaving}
                                />
                            ) : (
                                <div className="mb-6">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    {plan.period && (
                                        <span className="text-sm text-white/40 ml-1">{plan.period}</span>
                                    )}
                                </div>
                            )}

                            <Link
                                href={plan.href}
                                className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all mb-6 ${plan.highlight
                                    ? "bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 shadow-lg shadow-rose-500/25"
                                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                                    }`}
                            >
                                {plan.cta}
                            </Link>

                            <ul className="space-y-2.5">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                                        <span className={`mt-0.5 text-xs ${plan.highlight ? "text-rose-400" : "text-white/30"}`}>
                                            ✓
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ mini */}
            <section className="px-6 pb-16 bg-white/[0.02]">
                <div className="max-w-2xl mx-auto py-12">
                    <h2 className="text-2xl font-bold text-center mb-8">Câu hỏi về thanh toán</h2>
                    <div className="space-y-3">
                        {[
                            {
                                q: "Thanh toán bằng phương thức nào?",
                                a: "Chuyển khoản ngân hàng (QR code), ví MoMo, và các phương thức qua PayOS.",
                            },
                            {
                                q: "Có thể hủy bất cứ lúc nào không?",
                                a: "Có. Gói Pro có thể hủy ngay. Bạn vẫn dùng được đến hết chu kỳ thanh toán.",
                            },
                            {
                                q: "Gói Lifetime có hoàn tiền không?",
                                a: "Gói Lifetime được hoàn tiền trong 7 ngày nếu chưa sử dụng tính năng nào.",
                            },
                        ].map((faq) => (
                            <details
                                key={faq.q}
                                className="group p-5 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 transition-colors cursor-pointer"
                            >
                                <summary className="flex items-center justify-between font-medium text-sm list-none">
                                    {faq.q}
                                    <span className="text-white/30 group-open:rotate-45 transition-transform text-xl leading-none">
                                        +
                                    </span>
                                </summary>
                                <p className="mt-3 text-sm text-white/50 leading-relaxed">{faq.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-white/5">
                <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-white/30">
                    <span className="font-semibold text-white/60">
                        ELove <span className="text-rose-400">♡</span>
                    </span>
                    <span>© 2026 ELove. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}

function ProPriceBlock({
    monthlyPrice,
    yearlyPrice,
    yearlySaving,
}: {
    monthlyPrice: string;
    yearlyPrice: string;
    yearlySaving: string;
}) {
    return (
        <div className="mb-6">
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold">{monthlyPrice}</span>
                <span className="text-sm text-white/40">/ tháng</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
                <span className="text-white/40">hoặc {yearlyPrice} / năm</span>
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full font-medium">
                    {yearlySaving}
                </span>
            </div>
        </div>
    );
}
