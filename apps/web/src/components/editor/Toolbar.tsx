"use client";

interface ToolbarProps {
  projectId: string;
}

export function Toolbar({ projectId }: ToolbarProps) {
  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-800">ELove Editor</span>
        <span className="text-xs text-gray-400 font-mono">{projectId}</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">
          Xem trước
        </button>
        <button className="px-4 py-1 text-sm bg-rose-500 text-white rounded hover:bg-rose-600">
          Xuất bản
        </button>
      </div>
    </header>
  );
}
