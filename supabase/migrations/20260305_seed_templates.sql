-- ELove: Seed template data
-- Run after migration to populate the template gallery
-- Date: 2026-03-05

INSERT INTO templates (name, slug, category, description, thumbnail_url, status, plan_required, r2_bundle_key, current_version)
VALUES
  -- ============ FREE (BASIC) Templates ============
  (
    'Hạnh Phúc',
    'hanh-phuc',
    'wedding',
    'Mẫu thiệp cưới cổ điển với tông màu hồng pastel, hoa và bướm. Phù hợp cho đám cưới nhẹ nhàng, lãng mạn.',
    NULL,
    'published',
    'free',
    'elove/templates/hanh-phuc/v1/bundle.json',
    1
  ),
  (
    'Mùa Xuân',
    'mua-xuan',
    'wedding',
    'Thiệp cưới lấy cảm hứng từ mùa xuân với hoa đào, cành lá xanh tươi. Tông màu trắng hồng nhẹ nhàng.',
    NULL,
    'published',
    'free',
    'elove/templates/mua-xuan/v1/bundle.json',
    1
  ),
  (
    'Sinh Nhật Vui',
    'sinh-nhat-vui',
    'birthday',
    'Thiệp sinh nhật vui nhộn với confetti, bánh kem và bóng bay. Phù hợp cho mọi lứa tuổi.',
    NULL,
    'published',
    'free',
    'elove/templates/sinh-nhat-vui/v1/bundle.json',
    1
  ),
  (
    'Tốt Nghiệp',
    'tot-nghiep',
    'graduation',
    'Thiệp tốt nghiệp trang trọng với tông màu xanh navy và vàng gold. Bao gồm ảnh và thông tin buổi lễ.',
    NULL,
    'published',
    'free',
    'elove/templates/tot-nghiep/v1/bundle.json',
    1
  ),

  -- ============ PREMIUM Templates ============
  (
    'Hoàng Gia',
    'hoang-gia',
    'wedding',
    'Thiệp cưới sang trọng phong cách hoàng gia, tông vàng gold và navy. Hiệu ứng parallax, animations mượt mà.',
    NULL,
    'published',
    'pro',
    'elove/templates/hoang-gia/v1/bundle.json',
    1
  ),
  (
    'Minimalist',
    'minimalist',
    'wedding',
    'Thiệp cưới tối giản, typography đẹp, tông trắng đen với điểm nhấn vàng. Phong cách hiện đại, thanh lịch.',
    NULL,
    'published',
    'pro',
    'elove/templates/minimalist/v1/bundle.json',
    1
  ),
  (
    'Rustic Garden',
    'rustic-garden',
    'wedding',
    'Thiệp cưới phong cách rustic với hoa wildflower, gỗ, và dây leo. Tông nâu ấm và xanh rêu.',
    NULL,
    'published',
    'pro',
    'elove/templates/rustic-garden/v1/bundle.json',
    1
  ),
  (
    'Floral Elegance',
    'floral-elegance',
    'wedding',
    'Thiệp cưới hoa tươi cao cấp, watercolor hoa hồng và mẫu đơn. Hiệu ứng fade-in mượt mà.',
    NULL,
    'published',
    'pro',
    'elove/templates/floral-elegance/v1/bundle.json',
    1
  ),
  (
    'Anniversary Gold',
    'anniversary-gold',
    'anniversary',
    'Thiệp kỷ niệm ngày cưới tông vàng gold. Timeline ảnh, countdown, và nhạc nền.',
    NULL,
    'published',
    'pro',
    'elove/templates/anniversary-gold/v1/bundle.json',
    1
  ),
  (
    'Party Night',
    'party-night',
    'event',
    'Thiệp mời sự kiện phong cách neon night. Hiệu ứng glow, countdown timer, và bản đồ địa điểm.',
    NULL,
    'published',
    'pro',
    'elove/templates/party-night/v1/bundle.json',
    1
  ),
  (
    'Chúc Tết',
    'chuc-tet',
    'greeting',
    'Thiệp chúc Tết Nguyên Đán với hoa mai, đào, và pháo hoa. Hiệu ứng tuyết rơi và nhạc Tết.',
    NULL,
    'published',
    'pro',
    'elove/templates/chuc-tet/v1/bundle.json',
    1
  ),
  (
    'Baby Shower',
    'baby-shower',
    'event',
    'Thiệp mời tiệc baby shower dễ thương, tông pastel với gấu bông và bóng bay.',
    NULL,
    'published',
    'pro',
    'elove/templates/baby-shower/v1/bundle.json',
    1
  );
