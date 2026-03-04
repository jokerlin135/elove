import { describe, it, expect } from "vitest";
import { createEditorStore } from "../editor.store";
import type { ProjectDocument, Theme } from "@elove/shared";

// Minimal valid document for tests
function buildMinimalDocument(): ProjectDocument {
  return {
    schema_version: 1,
    structure: {
      pages: [{ id: "p1", slug: "home", title: "Home", sections: [] }],
      globalSlots: { navigation: null, musicPlayer: null, footer: null },
    },
    content: {
      data: {
        couple: { partner1: "Minh", partner2: "Lan", weddingDate: "2026-06-15", venue: "", story: "" },
        event: { ceremonies: [], receptions: [], afterParties: [] },
        gallery: { albums: [] },
        rsvp: { formFields: [], deadline: null },
        music: { tracks: [], autoplay: false },
      },
      slotContent: {},
      customSections: [],
    },
    behavior: {
      sectionBehaviors: {},
      pageTransitions: { type: "fade", duration: 300, easing: "ease" },
      globalBehaviors: { smoothScroll: true, lazyLoad: true, prefetch: false },
      accessibilityFallback: { reducedMotion: true, highContrast: false, screenReader: true },
    },
  };
}

function buildMinimalTheme(): Theme {
  return {
    baseThemeId: "minimal",
    tokens: {
      color: { primary: "#1A1A1A", secondary: "#666", accent: "#FF6B6B",
        background: "#FFF", surface: "#F5F5F5", text: "#1A1A1A", textMuted: "#999" },
      typography: {
        heading: { family: "Inter", weight: "700", sizes: { xl: "2.5rem" } },
        body: { family: "Inter", weight: "400", sizes: { md: "1rem" } },
      },
      spacing: { section: "3rem", element: "1rem", page: "1.5rem" },
      border: { radius: "2px", width: "1px", color: "#E5E5E5" },
      shadow: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 2px 8px rgba(0,0,0,0.08)", lg: "0 4px 16px rgba(0,0,0,0.1)" },
      animation: { duration: "300ms", easing: "ease", stagger: "50ms" },
    },
  };
}

describe("EditorStore", () => {
  it("initializes with document and computes lastSavedHash", () => {
    const store = createEditorStore({
      document: buildMinimalDocument(),
      theme: buildMinimalTheme(),
      editRevision: 0,
    });
    const state = store.getState();
    expect(state.document).toBeDefined();
    expect(state.lastSavedHash).toBeTruthy();
    expect(state.dirty).toBe(false);
  });

  it("marks dirty after setDirty(true)", () => {
    const store = createEditorStore({
      document: buildMinimalDocument(),
      theme: buildMinimalTheme(),
      editRevision: 0,
    });
    store.getState().setDirty(true);
    expect(store.getState().dirty).toBe(true);
  });

  it("selection is null on init", () => {
    const store = createEditorStore({
      document: buildMinimalDocument(),
      theme: buildMinimalTheme(),
      editRevision: 0,
    });
    expect(store.getState().selection.pageId).toBeNull();
    expect(store.getState().selection.sectionId).toBeNull();
    expect(store.getState().selection.slotId).toBeNull();
  });

  it("undo/redo cycle works", () => {
    const store = createEditorStore({
      document: buildMinimalDocument(),
      theme: buildMinimalTheme(),
      editRevision: 0,
    });

    const doc1 = store.getState().document;
    store.getState().pushToUndo();

    // Simulate document change
    const doc2 = { ...doc1, schema_version: 2 };
    store.getState().setDocument(doc2);
    expect(store.getState().document.schema_version).toBe(2);

    // Undo
    store.getState().undo();
    expect(store.getState().document.schema_version).toBe(1);

    // Redo
    store.getState().redo();
    expect(store.getState().document.schema_version).toBe(2);
  });

  it("markSaved resets dirty flag and updates hash", () => {
    const store = createEditorStore({
      document: buildMinimalDocument(),
      theme: buildMinimalTheme(),
      editRevision: 0,
    });
    store.getState().setDirty(true);
    store.getState().markSaved("newhash123", 1);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().lastSavedHash).toBe("newhash123");
    expect(store.getState().editRevision).toBe(1);
  });
});
