"use client";

export function PageTree() {
  return (
    <div className="flex flex-col p-2">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
        Trang
      </div>
      <div className="mt-1">
        <button className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100">
          Trang chủ
        </button>
      </div>
    </div>
  );
}
