"use client";
import Link from "next/link";
import { useStore } from "zustand";
import { useEditorStore } from "./EditorProvider";

export function Toolbar({ projectId }: { projectId: string }) {
  const store = useEditorStore();

  const dirty = useStore(store, (s) => s.dirty);
  const canUndo = useStore(store, (s) => s.undoStack.length > 0);
  const canRedo = useStore(store, (s) => s.redoStack.length > 0);

  return (
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
        <button className="px-3 py-1.5 text-xs text-white/50 hover:text-white border border-white/10 rounded-lg transition-colors">
          Xem trước
        </button>
        <button className="px-4 py-1.5 text-xs bg-gradient-to-r from-rose-500 to-pink-600 rounded-lg font-medium hover:opacity-90">
          Xuất bản
        </button>
      </div>
    </header>
  );
}
