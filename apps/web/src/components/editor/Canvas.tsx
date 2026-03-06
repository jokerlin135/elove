"use client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";
import type { Section } from "@elove/shared";

const SECTION_META: Record<string, { icon: string; label: string }> = {
  hero: { icon: "🌅", label: "Hero Banner" },
  text: { icon: "📝", label: "Văn bản" },
  image_gallery: { icon: "🖼️", label: "Album ảnh" },
  spacer: { icon: "↕️", label: "Khoảng trống" },
  event_info: { icon: "📅", label: "Thông tin sự kiện" },
  countdown: { icon: "⏳", label: "Đếm ngược" },
  map: { icon: "📍", label: "Bản đồ" },
  timeline: { icon: "📋", label: "Timeline" },
  rsvp: { icon: "✉️", label: "RSVP" },
  guestbook: { icon: "💌", label: "Lời chúc" },
  gift: { icon: "🎁", label: "Quà tặng" },
  music: { icon: "🎵", label: "Nhạc nền" },
};

function SectionBlock({
  section,
  isSelected,
  onClick,
}: {
  section: Section;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const compType = (section as unknown as { config?: { componentType?: string } }).config?.componentType ?? "unknown";
  const sectionMeta = SECTION_META[compType] ?? { icon: "📦", label: compType };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`relative mb-2 rounded-lg border-2 transition-all cursor-pointer ${isSelected
        ? "border-rose-500 shadow-lg shadow-rose-500/10"
        : "border-transparent hover:border-white/20"
        }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 hover:opacity-100 cursor-grab text-white/30 text-xs z-10"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </div>
      {/* Section content */}
      <div className="bg-white/5 border border-white/8 rounded-lg p-6 ml-6 flex items-center gap-4">
        <span className="text-2xl">{sectionMeta.icon}</span>
        <div>
          <div className="text-sm font-medium text-white/70">{sectionMeta.label}</div>
          <div className="text-xs text-white/30">{section.id.slice(0, 8)}</div>
        </div>
      </div>
    </div>
  );
}

export function Canvas() {
  const store = useEditorStore();
  const { pages, sel } = useStore(store, (s) => ({
    pages: s.document.structure.pages,
    sel: s.selection,
  }));

  const currentPage = pages.find(
    (p) => p.id === (sel.pageId ?? pages[0]?.id)
  );
  const sections: Section[] = currentPage?.sections ?? [];
  const sectionIds = sections.map((s) => s.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !currentPage) return;

    const state = store.getState();
    state.pushToUndo();

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(oldIndex, 1);
    newSections.splice(newIndex, 0, moved);

    const currentDoc = store.getState().document;
    const newDoc = JSON.parse(JSON.stringify(currentDoc));
    const pageIndex = newDoc.structure.pages.findIndex(
      (p: { id: string }) => p.id === currentPage.id
    );
    if (pageIndex !== -1) {
      newDoc.structure.pages[pageIndex].sections = newSections;
    }
    state.setDocument(newDoc);
  }

  return (
    <div className="min-h-full bg-[#080810] flex justify-center p-6">
      <div className="w-full max-w-2xl">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionIds}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                isSelected={sel.sectionId === section.id}
                onClick={() =>
                  store.getState().setSelection({
                    sectionId: section.id,
                    slotId: null,
                  })
                }
              />
            ))}
          </SortableContext>
        </DndContext>

        {sections.length === 0 && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-white/10 rounded-2xl text-white/20 text-sm">
            Kéo components vào đây để thiết kế thiệp cưới
          </div>
        )}

        <button className="mt-4 w-full py-3 border border-dashed border-white/10 rounded-xl text-white/30 hover:text-white/60 hover:border-white/20 text-sm transition-colors">
          + Thêm section
        </button>
      </div>
    </div>
  );
}
