"use client";
import { PageTree } from "./PageTree";
import { Canvas } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { Toolbar } from "./Toolbar";
import { ComponentLibrary } from "./ComponentLibrary";

interface EditorLayoutProps {
  projectId: string;
}

export function EditorLayout({ projectId }: EditorLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-[#080810] overflow-hidden">
      <Toolbar projectId={projectId} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Page Tree + Component Library */}
        <aside className="w-60 bg-[#0d0d1a] border-r border-white/5 flex flex-col overflow-hidden shrink-0">
          <div className="border-b border-white/5">
            <PageTree />
          </div>
          <div className="flex-1 overflow-hidden">
            <ComponentLibrary />
          </div>
        </aside>

        {/* Center — Canvas */}
        <main className="flex-1 overflow-auto">
          <Canvas />
        </main>

        {/* Right — Property Panel */}
        <aside className="w-72 bg-[#0d0d1a] border-l border-white/5 overflow-y-auto shrink-0">
          <PropertyPanel />
        </aside>
      </div>
    </div>
  );
}
