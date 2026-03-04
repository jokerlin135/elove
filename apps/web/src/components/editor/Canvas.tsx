"use client";

export function Canvas() {
  return (
    <div className="min-h-full bg-gray-200 flex items-center justify-center">
      <div className="bg-white shadow-xl" style={{ width: 800, minHeight: 600 }}>
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          Kéo components vào đây để thiết kế thiệp cưới
        </div>
      </div>
    </div>
  );
}
