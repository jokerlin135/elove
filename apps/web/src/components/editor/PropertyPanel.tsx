"use client";
import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";

export function PropertyPanel() {
  const store = useEditorStore();
  const { sel, doc } = useStore(store, (s) => ({
    sel: s.selection,
    doc: s.document,
  }));

  // document.content.data.couple per schema
  const couple = doc.content.data.couple;

  function updateCouple(field: string, value: string) {
    store.getState().pushToUndo();
    const newDoc = JSON.parse(JSON.stringify(doc));
    newDoc.content.data.couple[field] = value;
    store.getState().setDocument(newDoc);
  }

  return (
    <div className="h-full bg-[#0d0d1a] border-l border-white/5 overflow-y-auto text-white">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">
          {sel.sectionId ? "Section" : "Thuộc tính"}
        </h3>
      </div>

      {!sel.sectionId ? (
        <div className="p-4 space-y-4">
          <p className="text-xs text-white/30 mb-3">Thông tin cặp đôi</p>
          <div className="space-y-3">
            {(
              [
                { key: "partner1", label: "Cô dâu" },
                { key: "partner2", label: "Chú rể" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-white/40 block mb-1">{label}</label>
                <input
                  type="text"
                  value={couple[key] ?? ""}
                  onChange={(e) => updateCouple(key, e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-white/40 block mb-1">Ngày cưới</label>
              <input
                type="date"
                value={couple.weddingDate ?? ""}
                onChange={(e) => updateCouple("weddingDate", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <p className="text-xs text-white/30">Section ID: {sel.sectionId.slice(0, 8)}</p>
          <div>
            <label className="text-xs text-white/40 block mb-1">Animation</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              <option value="none">Không</option>
              <option value="fade">Fade in</option>
              <option value="slide-up">Slide up</option>
              <option value="zoom">Zoom in</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
