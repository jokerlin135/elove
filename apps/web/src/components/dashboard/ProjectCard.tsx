"use client";
import Link from "next/link";

interface ProjectCardProps {
  id: string;
  title: string;
  slug: string;
  status: string;
  onArchive: (id: string) => void;
}

export function ProjectCard({ id, title, slug, status, onArchive }: ProjectCardProps) {
  return (
    <div className="group rounded-2xl bg-white/5 border border-white/8 hover:border-rose-500/30 transition-all overflow-hidden">
      <div className="aspect-[4/3] bg-gradient-to-br from-rose-900/30 via-pink-900/20 to-purple-900/30 flex items-center justify-center">
        <span className="text-5xl opacity-20">&#9825;</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-medium text-sm truncate">{title}</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${
              status === "published"
                ? "bg-green-500/15 text-green-400"
                : "bg-white/10 text-white/40"
            }`}
          >
            {status === "published" ? "Live" : "Draft"}
          </span>
        </div>
        <p className="text-xs text-white/30 mb-3">/{slug}</p>
        <div className="flex items-center gap-2">
          <Link
            href={`/editor/${id}`}
            className="flex-1 text-center py-1.5 text-xs bg-rose-500/15 text-rose-300 rounded-lg hover:bg-rose-500/25 transition-colors"
          >
            Chinh sua
          </Link>
          <button
            onClick={() => {
              if (confirm("Copy link thiep?")) {
                navigator.clipboard.writeText(
                  `${window.location.origin}/w/${slug}`,
                );
              }
            }}
            className="flex-1 py-1.5 text-xs bg-white/5 text-white/50 rounded-lg hover:bg-white/10 transition-colors"
          >
            Chia se
          </button>
          <button
            onClick={() => onArchive(id)}
            className="py-1.5 px-2 text-xs text-white/20 hover:text-red-400 transition-colors"
            title="Xoa"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
}
