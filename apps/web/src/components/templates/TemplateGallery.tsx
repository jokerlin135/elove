"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "../../lib/trpc";

const CATEGORIES = [
    { id: "", label: "Tất cả" },
    { id: "wedding", label: "Thiệp cưới" },
    { id: "birthday", label: "Thiệp sinh nhật" },
    { id: "graduation", label: "Thiệp tốt nghiệp" },
    { id: "event", label: "Sự kiện" },
    { id: "anniversary", label: "Kỷ niệm" },
    { id: "greeting", label: "Lời chúc" },
    { id: "other", label: "Khác" },
];

const TIER_LABEL: Record<string, { text: string; className: string }> = {
    free: { text: "BASIC", className: "bg-white/10 text-white/60" },
    pro: { text: "PREMIUM", className: "bg-rose-500/20 text-rose-300" },
    lifetime: { text: "PREMIUM", className: "bg-rose-500/20 text-rose-300" },
};

type Template = {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    thumbnailUrl: string | null;
    planRequired: string;
    viewCount: number;
    heartCount: number;
};

export function TemplateGallery() {
    const [category, setCategory] = useState("");
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const [planFilter, setPlanFilter] = useState<"all" | "free" | "pro">("all");

    const templates = trpc.templates.list.useQuery(
        category ? { category } : undefined,
    );

    const filtered = (templates.data ?? []).filter((t) => {
        if (planFilter === "free") return t.planRequired === "free";
        if (planFilter === "pro") return t.planRequired !== "free";
        return true;
    });

    return (
        <>
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                    Mẫu thiệp online đẹp
                </h1>
                <p className="text-white/40 max-w-lg mx-auto">
                    Khám phá bộ sưu tập mẫu thiệp điện tử đa dạng: cưới, sinh nhật, sự kiện, kỷ niệm
                </p>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${category === cat.id
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-white/5 text-white/50 border border-white/8 hover:border-white/15 hover:text-white/70"
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Plan Filter */}
            <div className="flex items-center justify-end gap-2 mb-6">
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as "all" | "free" | "pro")}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-white/20"
                >
                    <option value="all">Tất cả gói</option>
                    <option value="free">BASIC</option>
                    <option value="pro">PREMIUM</option>
                </select>
            </div>

            {/* Grid */}
            {templates.isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse"
                        />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-white/30 text-lg">Chưa có mẫu thiệp nào</p>
                    <p className="text-white/20 text-sm mt-2">
                        Mẫu thiệp sẽ được thêm sớm. Hãy quay lại sau!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map((t) => (
                        <TemplateCard
                            key={t.id}
                            template={t}
                            onPreview={() => setPreviewTemplate(t)}
                        />
                    ))}
                </div>
            )}

            {/* Preview Modal */}
            {previewTemplate && (
                <TemplatePreviewModal
                    template={previewTemplate}
                    onClose={() => setPreviewTemplate(null)}
                />
            )}
        </>
    );
}

function TemplateCard({
    template,
    onPreview,
}: {
    template: Template;
    onPreview: () => void;
}) {
    const tier = TIER_LABEL[template.planRequired] ?? TIER_LABEL.free;

    return (
        <div
            onClick={onPreview}
            className="group relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/8 hover:border-rose-500/40 transition-all cursor-pointer"
        >
            {/* Thumbnail */}
            <div className="aspect-[3/4] bg-gradient-to-br from-rose-900/20 via-pink-900/10 to-fuchsia-900/20 flex items-center justify-center relative overflow-hidden">
                {template.thumbnailUrl ? (
                    <img
                        src={template.thumbnailUrl}
                        alt={template.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <span className="text-5xl opacity-20">♡</span>
                )}

                {/* Tier Badge */}
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-semibold ${tier.className}`}>
                    {tier.text}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-5 py-2 bg-white/10 backdrop-blur-sm rounded-xl text-sm font-medium border border-white/20">
                        Xem chi tiết
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="text-sm font-medium truncate mb-1">{template.name}</h3>
                <div className="flex items-center gap-3 text-xs text-white/30">
                    <span>👁 {template.viewCount}</span>
                    <span>♡ {template.heartCount}</span>
                </div>
            </div>
        </div>
    );
}

function TemplatePreviewModal({
    template,
    onClose,
}: {
    template: Template;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="relative bg-[#12121f] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto flex flex-col md:flex-row"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left — Preview */}
                <div className="w-full md:w-1/2 bg-gradient-to-br from-rose-900/15 to-pink-900/10 flex items-center justify-center p-8 min-h-[300px]">
                    {template.thumbnailUrl ? (
                        <img
                            src={template.thumbnailUrl}
                            alt={template.name}
                            className="max-w-full max-h-[60vh] rounded-xl shadow-2xl"
                        />
                    ) : (
                        <div className="w-48 h-72 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <span className="text-6xl opacity-20">♡</span>
                        </div>
                    )}
                </div>

                {/* Right — Info */}
                <div className="w-full md:w-1/2 p-6 flex flex-col">
                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center text-xl"
                    >
                        ×
                    </button>

                    <h2 className="text-xl font-bold mb-2">{template.name}</h2>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-white/40 mb-4">
                        <span className="text-rose-400">♡ {template.heartCount}</span>
                        <span>👁 {template.viewCount}</span>
                    </div>

                    {/* Tier */}
                    <div className="mb-4">
                        {template.planRequired === "free" ? (
                            <span className="px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs font-medium">
                                BASIC — Miễn phí
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-medium">
                                PREMIUM — Cần gói Pro
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    {template.description && (
                        <p className="text-sm text-white/50 leading-relaxed mb-6">
                            {template.description}
                        </p>
                    )}

                    <div className="text-sm text-white/40 mb-6 space-y-1.5">
                        <p>✓ Chuyên nghiệp: Thiết kế đẹp mắt, phù hợp nhiều phong cách</p>
                        <p>✓ Dễ dàng: Chỉnh sửa trực quan, không cần kinh nghiệm</p>
                        <p>✓ Tiện lợi: Chia sẻ ngay qua mạng xã hội hoặc tin nhắn</p>
                        <p>✓ Tối ưu: Hiển thị tốt trên mọi thiết bị</p>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto flex gap-3">
                        <Link
                            href={`/templates/${template.slug}`}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-center hover:bg-white/10 transition-colors"
                        >
                            Xem trực tiếp
                        </Link>
                        <Link
                            href={`/dashboard?template=${template.id}`}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/25"
                        >
                            Dùng mẫu này
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
