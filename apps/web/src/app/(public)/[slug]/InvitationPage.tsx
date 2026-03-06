"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Section renderers for public view
function HeroSection({ config }: { config: Record<string, string> }) {
    return (
        <section
            className="relative min-h-[60vh] flex items-center justify-center text-center px-6 py-20"
            style={{
                backgroundImage: config.imageUrl ? `url(${config.imageUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            {config.imageUrl && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative z-10">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                    {config.title || "Chào mừng"}
                </h1>
                {config.subtitle && (
                    <p className="text-lg text-white/70">{config.subtitle}</p>
                )}
            </div>
        </section>
    );
}

function TextSection({ config }: { config: Record<string, string> }) {
    return (
        <section className="px-6 py-12 max-w-xl mx-auto" style={{ textAlign: (config.align as "left" | "center" | "right") ?? "center" }}>
            {config.heading && <h2 className="text-2xl font-bold text-white mb-4">{config.heading}</h2>}
            {config.body && <p className="text-white/60 leading-relaxed whitespace-pre-wrap">{config.body}</p>}
        </section>
    );
}

function EventInfoSection({ config }: { config: Record<string, string> }) {
    return (
        <section className="px-6 py-12 max-w-lg mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-6">{config.eventTitle || "Thông tin sự kiện"}</h2>
            <div className="space-y-3 text-white/60">
                {config.date && <p className="text-lg">📅 {new Date(config.date).toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>}
                {config.time && <p>🕐 {config.time}</p>}
                {config.venue && <p className="text-lg font-medium text-white/80">📍 {config.venue}</p>}
                {config.address && <p className="text-sm text-white/40">{config.address}</p>}
            </div>
        </section>
    );
}

function CountdownSection({ config }: { config: Record<string, string> }) {
    const target = config.targetDate ? new Date(config.targetDate) : null;
    const now = new Date();
    const diff = target ? Math.max(0, target.getTime() - now.getTime()) : 0;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    return (
        <section className="px-6 py-12 text-center">
            <h2 className="text-xl font-bold text-white mb-6">{config.title || "Đếm ngược"}</h2>
            {diff > 0 ? (
                <div className="flex justify-center gap-6">
                    {[
                        { val: days, label: "Ngày" },
                        { val: hours, label: "Giờ" },
                        { val: mins, label: "Phút" },
                    ].map((item) => (
                        <div key={item.label} className="text-center">
                            <div className="text-3xl font-bold text-rose-400">{item.val}</div>
                            <div className="text-xs text-white/40 mt-1">{item.label}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-rose-300 text-lg">{config.expiredMessage || "Hôm nay là ngày trọng đại!"}</p>
            )}
        </section>
    );
}

function GallerySection({ config }: { config: Record<string, string> }) {
    const images = [config.image1, config.image2, config.image3].filter(Boolean);
    return (
        <section className="px-6 py-12">
            <h2 className="text-xl font-bold text-white mb-6 text-center">{config.title || "Album ảnh"}</h2>
            <div className={`grid gap-3 max-w-2xl mx-auto ${images.length >= 3 ? "grid-cols-3" : images.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {images.map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-white/5">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                ))}
            </div>
        </section>
    );
}

function MapSection({ config }: { config: Record<string, string> }) {
    return (
        <section className="px-6 py-12 max-w-lg mx-auto text-center">
            <h2 className="text-xl font-bold text-white mb-4">{config.title || "Bản đồ"}</h2>
            {config.displayAddress && <p className="text-white/50 mb-4">{config.displayAddress}</p>}
            {config.mapUrl && (
                <a href={config.mapUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 rounded-xl text-white hover:bg-white/15 transition-colors">
                    📍 Mở Google Maps
                </a>
            )}
        </section>
    );
}

function TimelineSection({ config }: { config: Record<string, string> }) {
    const events = [config.event1, config.event2, config.event3].filter(Boolean);
    return (
        <section className="px-6 py-12 max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-white mb-8 text-center">{config.title || "Câu chuyện"}</h2>
            <div className="space-y-6 border-l-2 border-rose-500/30 pl-6">
                {events.map((ev, i) => (
                    <div key={i} className="relative">
                        <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-rose-500 border-2 border-[#080810]" />
                        <p className="text-white/70">{ev}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

// RSVP Form
function RsvpSection({ config, projectId }: { config: Record<string, string>; projectId: string }) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [attending, setAttending] = useState<"yes" | "no" | "">("");
    const [guests, setGuests] = useState("1");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch("/api/rsvp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    guestName: name,
                    email: phone,
                    attending: attending === "yes",
                    partySize: parseInt(guests || "1", 10),
                }),
            });
            setSubmitted(true);
        } catch {
            // Silent fail
        }
        setLoading(false);
    }

    if (submitted) {
        return (
            <section className="px-6 py-12 text-center">
                <div className="max-w-sm mx-auto p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-emerald-400 text-lg font-medium">✓ Cảm ơn bạn!</p>
                    <p className="text-white/40 text-sm mt-2">Phản hồi của bạn đã được ghi nhận.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="px-6 py-12 max-w-sm mx-auto">
            <h2 className="text-xl font-bold text-white mb-2 text-center">{config.title || "Xác nhận tham dự"}</h2>
            {config.description && <p className="text-white/40 text-sm text-center mb-6">{config.description}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="Họ và tên" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                <input type="tel" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                <div className="flex gap-2">
                    {(["yes", "no"] as const).map((v) => (
                        <button key={v} type="button" onClick={() => setAttending(v)}
                            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${attending === v
                                ? v === "yes" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 border" : "bg-rose-500/20 border-rose-500/40 text-rose-400 border"
                                : "bg-white/5 border border-white/10 text-white/40 hover:text-white/60"
                                }`}>
                            {v === "yes" ? "✓ Sẽ tham dự" : "✗ Không thể"}
                        </button>
                    ))}
                </div>
                {attending === "yes" && (
                    <div>
                        <label className="text-xs text-white/40 block mb-1">Số khách</label>
                        <select value={guests} onChange={(e) => setGuests(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>{n} người</option>
                            ))}
                        </select>
                    </div>
                )}
                <button type="submit" disabled={loading || !name || !attending}
                    className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                    {loading ? "Đang gửi..." : "Gửi xác nhận"}
                </button>
            </form>
        </section>
    );
}

// Guestbook (Lời chúc)
function GuestbookSection({ config, projectId }: { config: Record<string, string>; projectId: string }) {
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch("/api/guestbook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, authorName: name, message }),
            });
            setSubmitted(true);
        } catch {
            // Silent fail
        }
        setLoading(false);
    }

    if (submitted) {
        return (
            <section className="px-6 py-12 text-center">
                <div className="max-w-sm mx-auto p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                    <p className="text-rose-400 text-lg font-medium">♡ Cảm ơn!</p>
                    <p className="text-white/40 text-sm mt-2">Lời chúc của bạn đã được gửi.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="px-6 py-12 max-w-sm mx-auto">
            <h2 className="text-xl font-bold text-white mb-6 text-center">{config.title || "Sổ lời chúc"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="Tên của bạn" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                <textarea placeholder={config.placeholder || "Gửi lời chúc tới cặp đôi..."} required value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500/50 resize-none" />
                <button type="submit" disabled={loading || !name || !message}
                    className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                    {loading ? "Đang gửi..." : "💌 Gửi lời chúc"}
                </button>
            </form>
        </section>
    );
}

// Gift Section
function GiftSection({ config }: { config: Record<string, string> }) {
    return (
        <section className="px-6 py-12 max-w-sm mx-auto text-center">
            <h2 className="text-xl font-bold text-white mb-6">{config.title || "Mừng cưới"}</h2>
            <div className="space-y-4">
                {config.bankName && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8 text-left">
                        <p className="text-xs text-white/30 mb-1">Chuyển khoản</p>
                        <p className="text-sm text-white font-medium">{config.bankName}</p>
                        <p className="text-lg font-mono text-rose-300 my-1">{config.accountNumber}</p>
                        <p className="text-xs text-white/50">{config.accountHolder}</p>
                    </div>
                )}
                {config.momoPhone && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8 text-left">
                        <p className="text-xs text-white/30 mb-1">MoMo</p>
                        <p className="text-lg font-mono text-rose-300">{config.momoPhone}</p>
                    </div>
                )}
            </div>
        </section>
    );
}

function SpacerSection({ config }: { config: Record<string, string> }) {
    const heights: Record<string, string> = { sm: "20px", md: "40px", lg: "80px", xl: "120px" };
    return <div style={{ height: heights[config.height ?? "md"] ?? "40px" }} />;
}

// Section Router
const SECTION_RENDERERS: Record<string, React.FC<{ config: Record<string, string>; projectId: string }>> = {
    hero: ({ config }) => <HeroSection config={config} />,
    text: ({ config }) => <TextSection config={config} />,
    event_info: ({ config }) => <EventInfoSection config={config} />,
    countdown: ({ config }) => <CountdownSection config={config} />,
    image_gallery: ({ config }) => <GallerySection config={config} />,
    map: ({ config }) => <MapSection config={config} />,
    timeline: ({ config }) => <TimelineSection config={config} />,
    rsvp: ({ config, projectId }) => <RsvpSection config={config} projectId={projectId} />,
    guestbook: ({ config, projectId }) => <GuestbookSection config={config} projectId={projectId} />,
    gift: ({ config }) => <GiftSection config={config} />,
    spacer: ({ config }) => <SpacerSection config={config} />,
    music: () => null, // handled separately
};

// Main Invitation Page
type InvitationPageProps = {
    projectId: string;
    slug: string;
    title: string;
    doc: {
        couple?: { partner1?: string; partner2?: string; weddingDate?: string };
        sections?: Array<{ id: string; config: Record<string, string> }>;
    } | null;
};

export default function InvitationPage({ projectId, slug, title, doc }: InvitationPageProps) {
    if (!doc || !doc.sections?.length) {
        return (
            <div className="min-h-screen bg-[#080810] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">💌</div>
                    <h1 className="text-2xl font-bold mb-2">{title || "Thiệp mời cưới"}</h1>
                    <p className="text-white/40 mb-6">Thiệp đang được hoàn thiện...</p>
                    <Link href="/" className="text-rose-400 hover:text-rose-300 text-sm">
                        ← Tạo thiệp với ELove
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080810] text-white">
            {/* Couple Header */}
            <header className="text-center py-16 px-6 bg-gradient-to-b from-rose-500/10 to-transparent">
                <p className="text-3xl md:text-5xl font-bold">{doc.couple?.partner1}</p>
                <p className="text-rose-400 text-2xl my-3">&</p>
                <p className="text-3xl md:text-5xl font-bold">{doc.couple?.partner2}</p>
                {doc.couple?.weddingDate && (
                    <p className="text-rose-300 mt-6">
                        {new Date(doc.couple.weddingDate).toLocaleDateString("vi-VN", {
                            weekday: "long", year: "numeric", month: "long", day: "numeric",
                        })}
                    </p>
                )}
            </header>

            {/* Dynamic Sections */}
            {doc.sections.map((section) => {
                const compType = section.config.componentType ?? "unknown";
                const Renderer = SECTION_RENDERERS[compType];
                if (!Renderer) return null;
                return <Renderer key={section.id} config={section.config} projectId={projectId} />;
            })}

            {/* Footer */}
            <footer className="text-center py-10 text-white/20 text-xs border-t border-white/5 mt-8">
                <p>Được tạo bởi <Link href="/" className="text-rose-400/60 hover:text-rose-400">ELove</Link></p>
            </footer>
        </div>
    );
}
