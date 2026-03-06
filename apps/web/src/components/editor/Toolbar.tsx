"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";
import { ShareDialog } from "./ShareDialog";
import { trpc } from "../../lib/trpc";

export function Toolbar({ projectId }: { projectId: string }) {
  const store = useEditorStore();
  const [showPreview, setShowPreview] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const dirty = useStore(store, (s) => s.dirty);
  const canUndo = useStore(store, (s) => s.undoStack.length > 0);
  const canRedo = useStore(store, (s) => s.redoStack.length > 0);
  const doc = useStore(store, (s) => s.document);



  async function handlePublish() {
    setPublishing(true);
    setPublishResult(null);
    try {
      // Publish via API
      await fetch(`/api/internal/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, document: doc }),
      });
      setPublishResult("success");
    } catch {
      setPublishResult("error");
    } finally {
      setPublishing(false);
      setTimeout(() => setPublishResult(null), 3000);
    }
  }

  return (
    <>
      <header className="h-12 bg-[#0d0d1a] border-b border-white/8 flex items-center justify-between px-4 shrink-0 text-white">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-white/40 hover:text-white transition-colors text-sm"
          >
            ← Dashboard
          </Link>
          <span className="text-white/20">|</span>
          {dirty && (
            <span className="text-xs text-amber-400/60">● Chưa lưu</span>
          )}
          {publishResult === "success" && (
            <span className="text-xs text-emerald-400">✓ Đã xuất bản</span>
          )}
          {publishResult === "error" && (
            <span className="text-xs text-rose-400">✗ Lỗi xuất bản</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => store.getState().undo()}
            disabled={!canUndo}
            className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            onClick={() => store.getState().redo()}
            disabled={!canRedo}
            className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${showPreview
              ? "text-rose-300 border-rose-500/30 bg-rose-500/10"
              : "text-white/50 hover:text-white border-white/10"
              }`}
          >
            {showPreview ? "✕ Đóng Preview" : "👁 Xem trước"}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-1.5 text-xs bg-gradient-to-r from-rose-500 to-pink-600 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {publishing ? "Đang xuất bản..." : "🚀 Xuất bản"}
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="px-3 py-1.5 text-xs text-white/50 hover:text-white border border-white/10 rounded-lg transition-colors"
          >
            📤 Chia sẻ
          </button>
        </div>
      </header>

      {/* Live Preview Panel */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
          <div className="relative bg-[#0d0d1a] rounded-2xl border border-white/10 overflow-hidden flex flex-col" style={{ width: 390, height: 700 }}>
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-xs text-white/40">📱 Mobile Preview</span>
              <button
                onClick={() => setShowPreview(false)}
                className="text-xs text-white/30 hover:text-white"
              >
                ✕
              </button>
            </div>
            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Couple Header */}
              <div className="text-center py-8 bg-gradient-to-b from-rose-500/10 to-transparent rounded-xl">
                <p className="text-xl font-bold text-white">
                  {doc.content.data.couple.partner1 ?? "Cô dâu"}
                </p>
                <p className="text-white/30 text-sm my-1">&amp;</p>
                <p className="text-xl font-bold text-white">
                  {doc.content.data.couple.partner2 ?? "Chú rể"}
                </p>
                {doc.content.data.couple.weddingDate && (
                  <p className="text-xs text-rose-300 mt-3">
                    {new Date(doc.content.data.couple.weddingDate).toLocaleDateString("vi-VN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Sections Preview */}
              {doc.structure.pages[0]?.sections.map((section) => {
                const config = (section as unknown as { config?: Record<string, string> }).config ?? {};
                const compType = config.componentType ?? "unknown";
                return (
                  <div
                    key={section.id}
                    className="rounded-xl bg-white/[0.03] border border-white/5 p-4"
                  >
                    <div className="text-[10px] text-white/20 uppercase tracking-wider mb-2">
                      {compType}
                    </div>
                    {config.title && (
                      <p className="text-sm font-medium text-white mb-1">{config.title}</p>
                    )}
                    {config.body && (
                      <p className="text-xs text-white/50">{config.body}</p>
                    )}
                    {config.venue && (
                      <p className="text-xs text-white/40">📍 {config.venue}</p>
                    )}
                    {config.date && (
                      <p className="text-xs text-white/40">📅 {config.date}</p>
                    )}
                    {!config.title && !config.body && !config.venue && (
                      <p className="text-xs text-white/20 italic">Chưa có nội dung</p>
                    )}
                  </div>
                );
              })}

              {(!doc.structure.pages[0]?.sections || doc.structure.pages[0].sections.length === 0) && (
                <div className="text-center py-8 text-white/20 text-sm">
                  Thêm sections để xem preview
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Dialog */}
      <ShareDialog projectSlug={projectId} open={showShare} onClose={() => setShowShare(false)} />
    </>
  );
}
