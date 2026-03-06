import Link from "next/link";

const TEMPLATES = [
  { id: 1, name: "Thiệp Cưới Cổ Điển", type: "PREMIUM", views: "12.4k", hearts: "890" },
  { id: 2, name: "Thiệp Cưới Tối Giản", type: "FREE", views: "9.1k", hearts: "672" },
  { id: 3, name: "Thiệp Cưới Vintage", type: "PREMIUM", views: "15.2k", hearts: "1.1k" },
  { id: 4, name: "Thiệp Cưới Xanh Mint", type: "FREE", views: "7.8k", hearts: "543" },
  { id: 5, name: "Thiệp Cưới Hồng Pastel", type: "FREE", views: "11.3k", hearts: "820" },
  { id: 6, name: "Thiệp Cưới Vàng Gold", type: "PREMIUM", views: "18.9k", hearts: "1.4k" },
];

const FEATURES = [
  {
    icon: "✦",
    title: "Hàng trăm mẫu thiệp",
    desc: "Kho mẫu đa dạng từ cổ điển đến hiện đại, dễ dàng chọn theo phong cách riêng của bạn.",
  },
  {
    icon: "✎",
    title: "Tùy chỉnh dễ dàng",
    desc: "Chỉnh màu sắc, font chữ, hình ảnh và nội dung ngay trong trình duyệt — không cần kỹ năng thiết kế.",
  },
  {
    icon: "⟳",
    title: "Chia sẻ thông minh",
    desc: "Gửi link qua Zalo, Facebook, SMS. Khách mời xem thiệp ngay trên điện thoại — không cần cài app.",
  },
  {
    icon: "♡",
    title: "Tương tác khách mời",
    desc: "Khách mời gửi lời chúc, RSVP xác nhận tham dự, tặng quà trực tuyến qua mã QR.",
  },
];

const FAQS = [
  {
    q: "ELove có miễn phí không?",
    a: "Có! Gói Free cho phép bạn tạo, tùy chỉnh và chia sẻ thiệp cưới hoàn toàn miễn phí. Nâng cấp Pro để mở khóa thêm mẫu cao cấp và tính năng nâng cao.",
  },
  {
    q: "Thiệp cưới hiển thị như thế nào trên điện thoại?",
    a: "Tất cả mẫu thiệp được tối ưu hóa cho mobile. Khách mời chỉ cần nhấn link là xem được ngay, không cần cài ứng dụng.",
  },
  {
    q: "Tôi có thể thêm nhạc nền vào thiệp không?",
    a: "Có. Bạn có thể chọn nhạc từ thư viện hoặc tải lên bài nhạc yêu thích để phát tự động khi khách mở thiệp.",
  },
  {
    q: "Thiệp cưới tồn tại bao lâu?",
    a: "Gói Free lưu trữ 6 tháng sau ngày cưới. Gói Pro và Lifetime lưu trữ vĩnh viễn.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#080810]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
            ELove
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Mẫu thiệp
          </Link>
          <Link
            href="/pricing"
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Gói dịch vụ
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
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Glow blobs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-8">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            Nền tảng thiệp cưới online #1 Việt Nam
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Kể câu chuyện
            <br />
            <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-600 bg-clip-text text-transparent">
              tình yêu của bạn
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto mb-10">
            Tạo thiệp cưới online đẹp, cá nhân hoá và chia sẻ dễ dàng. Miễn phí để bắt đầu.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-base font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/25"
            >
              Tạo thiệp ngay →
            </Link>
            <Link
              href="/templates"
              className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-full text-base font-medium hover:bg-white/10 transition-colors"
            >
              Xem mẫu thiệp
            </Link>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-14 text-sm">
            {[
              { num: "10,000+", label: "Thiệp đã tạo" },
              { num: "50+", label: "Mẫu thiệp" },
              { num: "99%", label: "Hài lòng" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-white">{s.num}</div>
                <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Template Showcase */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Mẫu thiệp nổi bật</h2>
            <p className="text-white/40">Hàng trăm mẫu đẹp, chọn và tuỳ chỉnh trong vài phút</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/8 hover:border-rose-500/40 transition-all cursor-pointer"
              >
                {/* Placeholder image */}
                <div className="aspect-[3/4] bg-gradient-to-br from-rose-900/30 via-pink-900/20 to-purple-900/30 flex items-center justify-center">
                  <span className="text-4xl opacity-30">♡</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${t.type === "PREMIUM"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-white/10 text-white/50"
                        }`}
                    >
                      {t.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    <span>👁 {t.views}</span>
                    <span>♡ {t.hearts}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm hover:bg-white/10 transition-colors"
            >
              Xem tất cả mẫu →
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">3 bước đơn giản</h2>
            <p className="text-white/40">Từ ý tưởng đến thiệp cưới online chỉ trong vài phút</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Chọn mẫu", desc: "Duyệt kho mẫu thiệp và chọn phong cách yêu thích", icon: "🎨" },
              { step: "2", title: "Tùy chỉnh", desc: "Chỉnh sửa nội dung, ảnh, màu sắc theo ý bạn", icon: "✏️" },
              { step: "3", title: "Chia sẻ", desc: "Gửi link hoặc QR code cho khách mời qua Zalo, SMS", icon: "🚀" },
            ].map((s, i) => (
              <div key={s.step} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-rose-500/30 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-600/20 flex items-center justify-center text-2xl mx-auto mb-4 relative">
                  {s.icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold">
                    {s.step}
                  </span>
                </div>
                <h3 className="font-semibold text-base mb-2">{s.title}</h3>
                <p className="text-sm text-white/40">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Khách hàng nói gì?</h2>
            <p className="text-white/40">Hơn 10,000 cặp đôi đã tin dùng ELove</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Minh & Hà", location: "TP.HCM", text: "Thiệp rất đẹp, khách mời ai cũng khen. RSVP tiện lợi, không cần gọi từng người!", stars: 5 },
              { name: "Tuấn & Linh", location: "Hà Nội", text: "Từ lúc chọn mẫu đến khi gửi cho khách chỉ mất 30 phút. Tuyệt vời!", stars: 5 },
              { name: "Phong & Mai", location: "Đà Nẵng", text: "Tính năng mừng cưới online rất hay! Khách ở xa vẫn có thể gửi quà dễ dàng.", stars: 5 },
            ].map((t) => (
              <div key={t.name} className="p-5 rounded-2xl bg-white/5 border border-white/8 hover:border-rose-500/20 transition-colors">
                <div className="flex gap-0.5 mb-3 text-amber-400 text-sm">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-xs font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{t.name}</p>
                    <p className="text-[10px] text-white/30">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tất cả những gì bạn cần</h2>
            <p className="text-white/40">Công cụ đơn giản, kết quả chuyên nghiệp</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl bg-white/5 border border-white/8 hover:border-rose-500/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-600/20 flex items-center justify-center text-rose-400 text-xl mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative p-10 rounded-3xl bg-gradient-to-br from-rose-500/10 to-pink-600/10 border border-rose-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent rounded-3xl" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Bắt đầu tạo thiệp cưới
                <br />
                <span className="text-rose-400">hoàn toàn miễn phí</span>
              </h2>
              <p className="text-white/50 mb-8 text-sm">
                Không cần thẻ tín dụng. Tạo và chia sẻ thiệp trong vài phút.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/30"
              >
                Tạo thiệp ngay — Miễn phí
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 bg-white/[0.02]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Câu hỏi thường gặp</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group p-5 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 transition-colors cursor-pointer"
              >
                <summary className="flex items-center justify-between font-medium text-sm list-none">
                  {faq.q}
                  <span className="text-white/30 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <span className="font-semibold text-white/60">
            ELove <span className="text-rose-400">♡</span>
          </span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Chính sách</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Điều khoản</Link>
          </div>
          <span>© 2026 ELove. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
