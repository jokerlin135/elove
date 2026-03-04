"use client";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectModal } from "./CreateProjectModal";

export function ProjectGrid() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery();
  const archiveMutation = trpc.projects.archive.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/5 animate-pulse aspect-[4/5]"
          />
        ))}
      </div>
    );
  }

  const active = projects?.filter((p) => p.status !== "archived") ?? [];

  return (
    <>
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4 opacity-30">&#9825;</div>
          <h3 className="text-lg font-medium mb-2">Chua co thiep nao</h3>
          <p className="text-white/30 text-sm mb-6">
            Tao thiep cuoi dau tien cua ban ngay bay gio
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-sm font-medium"
          >
            Tao thiep ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              title={p.title}
              slug={p.slug}
              status={p.status ?? "draft"}
              onArchive={(id) => archiveMutation.mutate({ projectId: id })}
            />
          ))}
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-2xl border-2 border-dashed border-white/10 hover:border-rose-500/30 transition-colors flex flex-col items-center justify-center aspect-[4/5] text-white/30 hover:text-rose-400"
          >
            <span className="text-3xl mb-2">+</span>
            <span className="text-sm">Tao thiep moi</span>
          </button>
        </div>
      )}
      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
