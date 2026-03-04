import { describe, it, expect } from "vitest";
import { executeCommand } from "../execute-command";
import { buildMinimalEditorState } from "../test-utils";

describe("Command System", () => {
  it("UPDATE_CONTENT updates couple name in document", () => {
    const state = buildMinimalEditorState();
    const next = executeCommand(state, {
      type: "UPDATE_CONTENT",
      payload: { path: "data.couple.partner1", value: "Minh" },
    });
    expect(next.document.content.data.couple.partner1).toBe("Minh");
    expect(next.dirty).toBe(true);
  });

  it("UPDATE_CONTENT returns new object (immutable)", () => {
    const state = buildMinimalEditorState();
    const next = executeCommand(state, {
      type: "UPDATE_CONTENT",
      payload: { path: "data.couple.partner1", value: "Minh" },
    });
    expect(next).not.toBe(state);
    expect(next.document).not.toBe(state.document);
  });

  it("UPDATE_THEME_TOKEN sets color.primary override", () => {
    const state = buildMinimalEditorState();
    const next = executeCommand(state, {
      type: "UPDATE_THEME_TOKEN",
      payload: { tokenPath: "color.primary", value: "#FF0000" },
    });
    expect((next.theme.overrides as Record<string, unknown> | undefined)?.["color"]).toMatchObject({ primary: "#FF0000" });
  });

  it("ADD_SECTION appends section to page", () => {
    const state = buildMinimalEditorState();
    const pageId = state.document.structure.pages[0].id;
    const before = state.document.structure.pages[0].sections.length;
    const next = executeCommand(state, {
      type: "ADD_SECTION",
      payload: { pageId, afterSectionId: null, sectionType: "gallery" },
    });
    expect(next.document.structure.pages[0].sections.length).toBe(before + 1);
    expect(next.document.structure.pages[0].sections.at(-1)!.type).toBe("gallery");
  });

  it("REMOVE_SECTION removes correct section", () => {
    const state = buildMinimalEditorState();
    const page = state.document.structure.pages[0];
    const sectionId = page.sections[0].id;
    const next = executeCommand(state, {
      type: "REMOVE_SECTION",
      payload: { pageId: page.id, sectionId },
    });
    expect(next.document.structure.pages[0].sections.find(s => s.id === sectionId)).toBeUndefined();
  });

  it("ADD_PAGE appends new page", () => {
    const state = buildMinimalEditorState();
    const before = state.document.structure.pages.length;
    const next = executeCommand(state, {
      type: "ADD_PAGE",
      payload: { slug: "gallery", title: "Thư viện ảnh" },
    });
    expect(next.document.structure.pages.length).toBe(before + 1);
    expect(next.document.structure.pages.at(-1)!.slug).toBe("gallery");
  });

  it("REMOVE_PAGE removes the specified page", () => {
    const state = buildMinimalEditorState();
    // Add a page first
    const withPage = executeCommand(state, {
      type: "ADD_PAGE",
      payload: { slug: "info", title: "Thông tin" },
    });
    const pageId = withPage.document.structure.pages.at(-1)!.id;
    const next = executeCommand(withPage, {
      type: "REMOVE_PAGE",
      payload: { pageId },
    });
    expect(next.document.structure.pages.find(p => p.id === pageId)).toBeUndefined();
  });

  it("executeCommand pushes old document to undoStack", () => {
    const state = buildMinimalEditorState();
    const next = executeCommand(state, {
      type: "UPDATE_CONTENT",
      payload: { path: "data.couple.partner1", value: "Minh" },
    });
    expect(next.undoStack).toHaveLength(1);
    expect(next.undoStack[0].content.data.couple.partner1).toBe("Anh"); // original
  });

  it("REORDER_PAGE moves page to target index", () => {
    const state = buildMinimalEditorState();
    // Add 2 more pages
    let s = executeCommand(state, { type: "ADD_PAGE", payload: { slug: "gallery", title: "Gallery" } });
    s = executeCommand(s, { type: "ADD_PAGE", payload: { slug: "info", title: "Info" } });
    // pages: [home, gallery, info]
    const pageId = s.document.structure.pages[2].id; // "info"
    const next = executeCommand(s, {
      type: "REORDER_PAGE",
      payload: { pageId, targetIndex: 0 },
    });
    expect(next.document.structure.pages[0].id).toBe(pageId);
  });
});
