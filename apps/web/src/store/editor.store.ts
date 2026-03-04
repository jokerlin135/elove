import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { sha256 } from "../utils/hash";
import type { ProjectDocument, Theme } from "@elove/shared";

export interface EditorSelection {
  pageId: string | null;
  sectionId: string | null;
  slotId: string | null;
}

export interface EditorState {
  document: ProjectDocument;
  theme: Theme;
  selection: EditorSelection;
  undoStack: ProjectDocument[];
  redoStack: ProjectDocument[];
  dirty: boolean;
  lastSavedHash: string;
  editRevision: number;
  serverEditRevision: number;

  // Actions
  setDirty: (dirty: boolean) => void;
  setSelection: (sel: Partial<EditorSelection>) => void;
  setDocument: (doc: ProjectDocument) => void;
  setTheme: (theme: Theme) => void;
  pushToUndo: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: (hash: string, revision: number) => void;
}

export function createEditorStore(init: {
  document: ProjectDocument;
  theme: Theme;
  editRevision: number;
}) {
  const initialHash = sha256(JSON.stringify(init.document));

  return create<EditorState>()(
    immer((set) => ({
      document: init.document,
      theme: init.theme,
      selection: { pageId: null, sectionId: null, slotId: null },
      undoStack: [],
      redoStack: [],
      dirty: false,
      lastSavedHash: initialHash,
      editRevision: init.editRevision,
      serverEditRevision: init.editRevision,

      setDirty: (dirty) =>
        set((s) => {
          s.dirty = dirty;
        }),

      setSelection: (sel) =>
        set((s) => {
          Object.assign(s.selection, sel);
        }),

      setDocument: (doc) =>
        set((s) => {
          s.document = doc;
          s.dirty = true;
          s.redoStack = [];
        }),

      setTheme: (theme) =>
        set((s) => {
          s.theme = theme;
          s.dirty = true;
        }),

      pushToUndo: () =>
        set((s) => {
          s.undoStack.push(JSON.parse(JSON.stringify(s.document)));
          if (s.undoStack.length > 100) s.undoStack.shift();
        }),

      undo: () =>
        set((s) => {
          const prev = s.undoStack.pop();
          if (!prev) return;
          s.redoStack.push(JSON.parse(JSON.stringify(s.document)));
          s.document = prev;
          s.dirty = true;
        }),

      redo: () =>
        set((s) => {
          const next = s.redoStack.pop();
          if (!next) return;
          s.undoStack.push(JSON.parse(JSON.stringify(s.document)));
          s.document = next;
          s.dirty = true;
        }),

      markSaved: (hash, revision) =>
        set((s) => {
          s.lastSavedHash = hash;
          s.editRevision = revision;
          s.dirty = false;
        }),
    })),
  );
}

export type EditorStore = ReturnType<typeof createEditorStore>;
