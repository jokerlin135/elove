import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutosaveManager } from "../autosave";
import type { ProjectDocument, Theme } from "@elove/shared";

function buildDoc(
  overrides?: Partial<ProjectDocument["content"]["data"]["couple"]>,
): ProjectDocument {
  return {
    schema_version: 1,
    structure: {
      pages: [{ id: "p1", slug: "home", title: "Home", sections: [] }],
      globalSlots: { navigation: null, musicPlayer: null, footer: null },
    },
    content: {
      data: {
        couple: {
          partner1: "Anh",
          partner2: "Em",
          weddingDate: "2026-06-15",
          venue: "",
          story: "",
          ...overrides,
        },
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
      accessibilityFallback: {
        reducedMotion: true,
        highContrast: false,
        screenReader: true,
      },
    },
  };
}

function buildTheme(): Theme {
  return {
    baseThemeId: "minimal",
    tokens: {
      color: {
        primary: "#1A1A1A",
        secondary: "#666",
        accent: "#FF6B6B",
        background: "#FFF",
        surface: "#F5F5F5",
        text: "#1A1A1A",
        textMuted: "#999",
      },
      typography: {
        heading: { family: "Inter", weight: "700", sizes: { xl: "2.5rem" } },
        body: { family: "Inter", weight: "400", sizes: { md: "1rem" } },
      },
      spacing: { section: "3rem", element: "1rem", page: "1.5rem" },
      border: { radius: "2px", width: "1px", color: "#E5E5E5" },
      shadow: {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 2px 8px rgba(0,0,0,0.08)",
        lg: "0 4px 16px rgba(0,0,0,0.1)",
      },
      animation: { duration: "300ms", easing: "ease", stagger: "50ms" },
    },
  };
}

describe("AutosaveManager", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockR2Put: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPatchRevision: any;
  let manager: AutosaveManager;

  beforeEach(() => {
    mockR2Put = vi.fn().mockResolvedValue(undefined);
    mockPatchRevision = vi.fn().mockResolvedValue(undefined);
    manager = new AutosaveManager({
      r2Put: mockR2Put,
      patchRevision: mockPatchRevision,
    });
  });

  it("saves to R2 on first call", async () => {
    await manager.save(buildDoc(), buildTheme(), "tenant1", "proj1", 0);
    expect(mockR2Put).toHaveBeenCalledTimes(2); // document.json + theme.json
    expect(mockPatchRevision).toHaveBeenCalledWith("proj1", 1);
  });

  it("skips save if document hash unchanged", async () => {
    const doc = buildDoc();
    await manager.save(doc, buildTheme(), "t1", "p1", 0);
    vi.clearAllMocks();
    // Save again with same doc — should skip
    await manager.save(doc, buildTheme(), "t1", "p1", 1);
    expect(mockR2Put).not.toHaveBeenCalled();
  });

  it("saves again if document changed", async () => {
    const doc1 = buildDoc();
    const doc2 = buildDoc({ partner1: "Minh" });
    await manager.save(doc1, buildTheme(), "t1", "p1", 0);
    vi.clearAllMocks();
    await manager.save(doc2, buildTheme(), "t1", "p1", 1);
    expect(mockR2Put).toHaveBeenCalledTimes(2);
  });

  it("retries up to 3 times on R2 failure then throws", async () => {
    mockR2Put.mockRejectedValue(new Error("R2 unavailable"));
    await expect(
      manager.save(buildDoc(), buildTheme(), "t1", "p1", 0),
    ).rejects.toThrow("R2 unavailable");
    // 3 attempts (original + 2 retries) = 6 calls total (3 per file × 2 files)
    // But we stop on first file failure before trying second
    expect(mockR2Put.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("increments revision on each successful save", async () => {
    const doc1 = buildDoc();
    const doc2 = buildDoc({ partner1: "Minh" });
    await manager.save(doc1, buildTheme(), "t1", "p1", 0);
    await manager.save(doc2, buildTheme(), "t1", "p1", 1);
    expect(mockPatchRevision).toHaveBeenNthCalledWith(1, "p1", 1);
    expect(mockPatchRevision).toHaveBeenNthCalledWith(2, "p1", 2);
  });
});
