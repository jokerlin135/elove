"use client";
import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";

export function PageTree() {
  const store = useEditorStore();
  const { pages, currentPageId } = useStore(store, (s) => ({
    pages: s.document.structure.pages,
    currentPageId: s.selection.pageId ?? s.document.structure.pages[0]?.id,
  }));

  return (
    <div className="h-full bg-[#0d0d1a] border-r border-white/5 text-white overflow-y-auto">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Trang</h3>
      </div>
      <div className="p-2">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() =>
              store.getState().setSelection({ pageId: page.id, sectionId: null })
            }
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              page.id === currentPageId
                ? "bg-rose-500/15 text-rose-300"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            {page.title ?? page.slug ?? page.id.slice(0, 8)}
          </button>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-white/5 mt-2">
        <p className="text-xs text-white/20 text-center">Components</p>
      </div>
      <div className="p-2 space-y-1">
        {[
          { icon: "📝", label: "Text" },
          { icon: "🖼", label: "Ảnh" },
          { icon: "👫", label: "Cặp đôi" },
          { icon: "📅", label: "Sự kiện" },
          { icon: "🎵", label: "Nhạc" },
          { icon: "💌", label: "RSVP" },
        ].map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/5 cursor-grab transition-colors"
          >
            <span>{c.icon}</span>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
