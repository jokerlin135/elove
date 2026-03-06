"use client";
import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";
import { executeCommand } from "../../editor/execute-command";
import type { Section } from "@elove/shared";

// ─── Shared Input Component ────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 block mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
        />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-white/40 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Section Data Helper ───────────────────────────
function useSectionData(sectionId: string) {
  const store = useEditorStore();
  const { doc } = useStore(store, (s) => ({ doc: s.document }));

  const section = doc.structure.pages
    .flatMap((p) => p.sections)
    .find((s) => s.id === sectionId) as (Section & { config?: Record<string, unknown> }) | undefined;

  const config = (section?.config ?? {}) as Record<string, string>;

  function updateField(key: string, value: string) {
    const state = store.getState();
    state.pushToUndo();
    const next = executeCommand(
      {
        document: state.document,
        theme: state.theme,
        undoStack: [],
        redoStack: [],
        dirty: true,
      },
      {
        type: "UPDATE_CONTENT",
        payload: {
          path: `sections.${sectionId}.config.${key}`,
          value,
        },
      },
    );
    state.setDocument(next.document);
  }

  return { section, config, updateField };
}

// ─── Section Type Editors ──────────────────────────

function HeroEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Tên cặp đôi" />
      <Field label="Phụ đề" value={config.subtitle ?? ""} onChange={(v) => updateField("subtitle", v)} placeholder="We're getting married!" />
      <Field label="URL ảnh bìa" value={config.imageUrl ?? ""} onChange={(v) => updateField("imageUrl", v)} placeholder="https://..." />
      <SelectField label="Hiệu ứng" value={config.effect ?? "parallax"} onChange={(v) => updateField("effect", v)}
        options={[
          { value: "parallax", label: "Parallax" },
          { value: "fade", label: "Fade" },
          { value: "zoom", label: "Zoom" },
          { value: "none", label: "Không" },
        ]}
      />
    </div>
  );
}

function TextEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.heading ?? ""} onChange={(v) => updateField("heading", v)} placeholder="Lời mời" />
      <Field label="Nội dung" value={config.body ?? ""} onChange={(v) => updateField("body", v)} type="textarea" placeholder="Nội dung đoạn văn bản..." />
      <SelectField label="Căn chỉnh" value={config.align ?? "center"} onChange={(v) => updateField("align", v)}
        options={[
          { value: "left", label: "Trái" },
          { value: "center", label: "Giữa" },
          { value: "right", label: "Phải" },
        ]}
      />
    </div>
  );
}

function EventInfoEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề sự kiện" value={config.eventTitle ?? ""} onChange={(v) => updateField("eventTitle", v)} placeholder="Lễ cưới" />
      <Field label="Ngày" value={config.date ?? ""} onChange={(v) => updateField("date", v)} type="date" />
      <Field label="Giờ" value={config.time ?? ""} onChange={(v) => updateField("time", v)} type="time" />
      <Field label="Địa điểm" value={config.venue ?? ""} onChange={(v) => updateField("venue", v)} placeholder="Nhà hàng ABC" />
      <Field label="Địa chỉ" value={config.address ?? ""} onChange={(v) => updateField("address", v)} placeholder="123 Đường XYZ, TP.HCM" />
    </div>
  );
}

function CountdownEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Đếm ngược" />
      <Field label="Ngày đích" value={config.targetDate ?? ""} onChange={(v) => updateField("targetDate", v)} type="datetime-local" />
      <Field label="Thông điệp hết giờ" value={config.expiredMessage ?? ""} onChange={(v) => updateField("expiredMessage", v)} placeholder="Hôm nay là ngày trọng đại!" />
    </div>
  );
}

function MapEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Địa điểm" />
      <Field label="Google Maps URL" value={config.mapUrl ?? ""} onChange={(v) => updateField("mapUrl", v)} placeholder="https://maps.google.com/..." />
      <Field label="Địa chỉ hiển thị" value={config.displayAddress ?? ""} onChange={(v) => updateField("displayAddress", v)} placeholder="123 Đường XYZ" />
    </div>
  );
}

function TimelineEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Câu chuyện tình yêu" />
      <Field label="Sự kiện 1" value={config.event1 ?? ""} onChange={(v) => updateField("event1", v)} placeholder="2020 — Lần đầu gặp mặt" />
      <Field label="Sự kiện 2" value={config.event2 ?? ""} onChange={(v) => updateField("event2", v)} placeholder="2022 — Hẹn hò chính thức" />
      <Field label="Sự kiện 3" value={config.event3 ?? ""} onChange={(v) => updateField("event3", v)} placeholder="2025 — Đám cưới" />
    </div>
  );
}

function RsvpEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Xác nhận tham dự" />
      <Field label="Mô tả" value={config.description ?? ""} onChange={(v) => updateField("description", v)} type="textarea" placeholder="Vui lòng xác nhận tham dự trước ngày..." />
      <Field label="Hạn RSVP" value={config.deadline ?? ""} onChange={(v) => updateField("deadline", v)} type="date" />
    </div>
  );
}

function GuestbookEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Sổ lời chúc" />
      <Field label="Placeholder" value={config.placeholder ?? ""} onChange={(v) => updateField("placeholder", v)} placeholder="Gửi lời chúc tới cặp đôi..." />
    </div>
  );
}

function GiftEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Mừng cưới" />
      <Field label="Tên ngân hàng" value={config.bankName ?? ""} onChange={(v) => updateField("bankName", v)} placeholder="Vietcombank" />
      <Field label="Số tài khoản" value={config.accountNumber ?? ""} onChange={(v) => updateField("accountNumber", v)} placeholder="0123456789" />
      <Field label="Chủ tài khoản" value={config.accountHolder ?? ""} onChange={(v) => updateField("accountHolder", v)} placeholder="NGUYEN VAN A" />
      <Field label="MoMo" value={config.momoPhone ?? ""} onChange={(v) => updateField("momoPhone", v)} placeholder="0912345678" />
    </div>
  );
}

function MusicEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="URL nhạc (MP3)" value={config.audioUrl ?? ""} onChange={(v) => updateField("audioUrl", v)} placeholder="https://..." />
      <SelectField label="Tự động phát" value={config.autoplay ?? "true"} onChange={(v) => updateField("autoplay", v)}
        options={[
          { value: "true", label: "Có" },
          { value: "false", label: "Không" },
        ]}
      />
      <SelectField label="Lặp lại" value={config.loop ?? "true"} onChange={(v) => updateField("loop", v)}
        options={[
          { value: "true", label: "Có" },
          { value: "false", label: "Không" },
        ]}
      />
    </div>
  );
}

function ImageGalleryEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <Field label="Tiêu đề" value={config.title ?? ""} onChange={(v) => updateField("title", v)} placeholder="Album ảnh" />
      <SelectField label="Bố cục" value={config.layout ?? "grid"} onChange={(v) => updateField("layout", v)}
        options={[
          { value: "grid", label: "Lưới (Grid)" },
          { value: "carousel", label: "Carousel" },
          { value: "masonry", label: "Masonry" },
        ]}
      />
      <Field label="Ảnh 1 URL" value={config.image1 ?? ""} onChange={(v) => updateField("image1", v)} placeholder="https://..." />
      <Field label="Ảnh 2 URL" value={config.image2 ?? ""} onChange={(v) => updateField("image2", v)} placeholder="https://..." />
      <Field label="Ảnh 3 URL" value={config.image3 ?? ""} onChange={(v) => updateField("image3", v)} placeholder="https://..." />
    </div>
  );
}

function SpacerEditor({ sectionId }: { sectionId: string }) {
  const { config, updateField } = useSectionData(sectionId);
  return (
    <div className="space-y-3">
      <SelectField label="Chiều cao" value={config.height ?? "md"} onChange={(v) => updateField("height", v)}
        options={[
          { value: "sm", label: "Nhỏ (20px)" },
          { value: "md", label: "Vừa (40px)" },
          { value: "lg", label: "Lớn (80px)" },
          { value: "xl", label: "Rất lớn (120px)" },
        ]}
      />
    </div>
  );
}

// ─── Section Editor Router ─────────────────────────
const SECTION_EDITORS: Record<string, React.FC<{ sectionId: string }>> = {
  hero: HeroEditor,
  text: TextEditor,
  image_gallery: ImageGalleryEditor,
  spacer: SpacerEditor,
  event_info: EventInfoEditor,
  countdown: CountdownEditor,
  map: MapEditor,
  timeline: TimelineEditor,
  rsvp: RsvpEditor,
  guestbook: GuestbookEditor,
  gift: GiftEditor,
  music: MusicEditor,
};

// ─── Main PropertyPanel ────────────────────────────

export function PropertyPanel() {
  const store = useEditorStore();
  const { sel, doc } = useStore(store, (s) => ({
    sel: s.selection,
    doc: s.document,
  }));

  const couple = doc.content.data.couple;

  function updateCouple(field: string, value: string) {
    store.getState().pushToUndo();
    const newDoc = JSON.parse(JSON.stringify(doc));
    newDoc.content.data.couple[field] = value;
    store.getState().setDocument(newDoc);
  }

  // Find selected section and its component type
  const selectedSection = sel.sectionId
    ? doc.structure.pages
      .flatMap((p) => p.sections)
      .find((s) => s.id === sel.sectionId) as (Section & { config?: Record<string, unknown> }) | undefined
    : undefined;

  const compType = selectedSection
    ? ((selectedSection.config?.componentType as string) ?? "unknown")
    : null;

  const SectionEditor = compType ? SECTION_EDITORS[compType] : null;

  return (
    <div className="h-full bg-[#0d0d1a] border-l border-white/5 overflow-y-auto text-white">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
          {sel.sectionId ? "Chỉnh sửa Section" : "Thuộc tính"}
        </h3>
      </div>

      {!sel.sectionId ? (
        /* ─── Couple Info (Default) ─── */
        <div className="p-4 space-y-4">
          <p className="text-xs text-white/30 mb-3">Thông tin cặp đôi</p>
          <div className="space-y-3">
            {([
              { key: "partner1", label: "Cô dâu" },
              { key: "partner2", label: "Chú rể" },
            ] as const).map(({ key, label }) => (
              <Field
                key={key}
                label={label}
                value={couple[key] ?? ""}
                onChange={(v) => updateCouple(key, v)}
              />
            ))}
            <Field
              label="Ngày cưới"
              value={couple.weddingDate ?? ""}
              onChange={(v) => updateCouple("weddingDate", v)}
              type="date"
            />
          </div>
        </div>
      ) : (
        /* ─── Section-Specific Editor ─── */
        <div className="p-4 space-y-4">
          {/* Section type badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
            <span className="text-xs text-white/30">Type:</span>
            <span className="text-xs font-medium text-rose-300">{compType ?? "unknown"}</span>
          </div>

          {SectionEditor ? (
            <SectionEditor sectionId={sel.sectionId} />
          ) : (
            <p className="text-xs text-white/30">
              Không có editor cho loại section này.
            </p>
          )}

          {/* Common: Animation */}
          <div className="pt-3 border-t border-white/5">
            <SelectField
              label="Animation"
              value="none"
              onChange={() => { }}
              options={[
                { value: "none", label: "Không" },
                { value: "fade", label: "Fade in" },
                { value: "slide-up", label: "Slide up" },
                { value: "zoom", label: "Zoom in" },
              ]}
            />
          </div>

          {/* Delete section */}
          <button
            onClick={() => {
              if (!sel.sectionId) return;
              const pageId = sel.pageId ?? doc.structure.pages[0]?.id;
              if (!pageId) return;
              const state = store.getState();
              state.pushToUndo();
              const next = executeCommand(
                {
                  document: state.document,
                  theme: state.theme,
                  undoStack: [],
                  redoStack: [],
                  dirty: true,
                },
                {
                  type: "REMOVE_SECTION",
                  payload: { pageId, sectionId: sel.sectionId },
                },
              );
              state.setDocument(next.document);
              state.setSelection({ sectionId: null, slotId: null });
            }}
            className="w-full py-2 text-xs text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            🗑 Xóa section này
          </button>
        </div>
      )}
    </div>
  );
}
