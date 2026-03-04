"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { trpc } from "../../lib/trpc";
import { createEditorStore, type EditorStore } from "../../store/editor.store";
import { sha256 } from "../../utils/hash";

const EditorContext = createContext<EditorStore | null>(null);

export function useEditorStore() {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditorStore must be inside EditorProvider");
  return store;
}

export function EditorProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [store, setStore] = useState<EditorStore | null>(null);
  const storeRef = useRef<EditorStore | null>(null);

  const { data, isLoading } = trpc.projects.get.useQuery({ projectId });
  const updateMutation = trpc.projects.update.useMutation();

  useEffect(() => {
    if (!data) return;
    const s = createEditorStore({
      document: data.document,
      theme: data.theme,
      editRevision: data.project.edit_revision ?? 0,
    });
    storeRef.current = s;
    setStore(s);
  }, [data]);

  // Autosave every 3s when dirty
  useEffect(() => {
    const interval = setInterval(() => {
      const s = storeRef.current;
      if (!s) return;
      const state = s.getState();
      if (!state.dirty) return;

      const documentJson = JSON.stringify(state.document);
      const themeJson = JSON.stringify(state.theme);
      const nextRevision = (state.editRevision ?? 0) + 1;
      // Capture hash at save time so markSaved uses the correct snapshot hash
      const savedDocHash = sha256(documentJson);

      updateMutation.mutate(
        { projectId, documentJson, themeJson, editRevision: nextRevision },
        {
          onSuccess: () => {
            s.getState().markSaved(savedDocHash, nextRevision);
          },
        },
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (isLoading || !store) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080810] text-white">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">&#9825;</div>
          <p className="text-white/40 text-sm">Dang tai thiep...</p>
        </div>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={store}>{children}</EditorContext.Provider>
  );
}
