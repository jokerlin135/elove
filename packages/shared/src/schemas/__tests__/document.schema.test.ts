import { describe, it, expect } from "vitest";
import { ProjectDocumentSchema, ThemeSchema } from "../document.schema";

describe("ProjectDocumentSchema", () => {
  it("validates a minimal valid document", () => {
    const doc = {
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
    const result = ProjectDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it("rejects document with missing couple data", () => {
    const doc = { schema_version: 1, structure: {}, content: {}, behavior: {} };
    const result = ProjectDocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

describe("ThemeSchema", () => {
  it("validates a valid theme", () => {
    const theme = {
      baseThemeId: "elegant",
      tokens: {
        color: { primary: "#8B5E3C", secondary: "#C4A882", accent: "#D4AF37",
          background: "#FAF8F5", surface: "#FFFFFF", text: "#2C2C2C", textMuted: "#888888" },
        typography: {
          heading: { family: "Playfair Display", weight: "700", sizes: { xl: "3rem" } },
          body: { family: "Lora", weight: "400", sizes: { md: "1rem" } },
        },
        spacing: { section: "5rem", element: "1.5rem", page: "2rem" },
        border: { radius: "4px", width: "1px", color: "#C4A882" },
        shadow: { sm: "0 1px 3px rgba(0,0,0,0.1)", md: "0 4px 12px rgba(0,0,0,0.1)", lg: "0 8px 24px rgba(0,0,0,0.15)" },
        animation: { duration: "600ms", easing: "ease-in-out", stagger: "100ms" },
      },
    };
    expect(ThemeSchema.safeParse(theme).success).toBe(true);
  });
});
