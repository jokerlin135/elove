"use client";
import React, { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import {
  createEditorStore,
  type EditorStore,
  type EditorState,
} from "./editor.store";
import type { ProjectDocument, Theme } from "@elove/shared";

// ========== CONTEXT ==========

const EditorStoreContext = createContext<EditorStore | null>(null);

// ========== PROVIDER ==========

interface EditorProviderProps {
  children: React.ReactNode;
  document: ProjectDocument;
  theme: Theme;
  editRevision: number;
}

export function EditorProvider({
  children,
  document,
  theme,
  editRevision,
}: EditorProviderProps) {
  const storeRef = useRef<EditorStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createEditorStore({ document, theme, editRevision });
  }

  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  );
}

// ========== HOOK ==========

/**
 * Access the editor store. Returns a safe no-op state when called outside
 * of an EditorProvider (e.g., in unit tests that don't mount the full editor).
 */
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  const store = useContext(EditorStoreContext);

  if (!store) {
    // No-op fallback for contexts without a provider (e.g., tests or static previews)
    return selector({
      document: {} as ProjectDocument,
      theme: {} as Theme,
      selection: { pageId: null, sectionId: null, slotId: null },
      undoStack: [],
      redoStack: [],
      dirty: false,
      lastSavedHash: "",
      editRevision: 0,
      serverEditRevision: 0,
      setDirty: () => {},
      setSelection: () => {},
      setDocument: () => {},
      setTheme: () => {},
      pushToUndo: () => {},
      undo: () => {},
      redo: () => {},
      markSaved: () => {},
    });
  }

  return useStore(store, selector);
}
