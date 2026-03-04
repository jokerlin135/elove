"use client";
import { PageTree } from "./PageTree";
import { Canvas } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { Toolbar } from "./Toolbar";

interface EditorLayoutProps {
  projectId: string;
}

export function EditorLayout({ projectId }: EditorLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <Toolbar projectId={projectId} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
          <PageTree />
        </aside>
        <main className="flex-1 overflow-auto p-4">
          <Canvas />
        </main>
        <aside className="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
          <PropertyPanel />
        </aside>
      </div>
    </div>
  );
}
