import { describe, it, expect } from "vitest";
import { runPipeline } from "../pipeline/index.js";

interface MockDeps {
  r2: {
    get: (key: string) => Promise<string>;
    put: (
      key: string,
      body: string,
      opts?: Record<string, unknown>,
    ) => Promise<void>;
  };
  db: {
    update: () => { set: () => { where: () => Promise<void> } };
  };
  cfApiToken: string;
  cfZoneId: string;
}

function mockDeps(): MockDeps {
  const store: Record<string, string> = {
    "projects/t1/p1/document.json": JSON.stringify({
      schema_version: 1,
      structure: {
        pages: [
          {
            id: "pg1",
            slug: "home",
            title: "Trang chu",
            sections: [],
          },
        ],
        globalSlots: {
          navigation: null,
          musicPlayer: null,
          footer: null,
        },
      },
      content: {
        data: {
          couple: {
            partner1: "Minh",
            partner2: "Lan",
            weddingDate: "2026-06-15",
            venue: "Ha Noi",
            story: "",
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
        globalBehaviors: {
          smoothScroll: true,
          lazyLoad: true,
          prefetch: false,
        },
        accessibilityFallback: {
          reducedMotion: true,
          highContrast: false,
          screenReader: true,
        },
      },
    }),
    "projects/t1/p1/theme.json": JSON.stringify({
      baseThemeId: "elegant",
      tokens: {
        color: {
          primary: "#8B5E3C",
          secondary: "#C4A882",
          accent: "#D4AF37",
          background: "#FAF8F5",
          surface: "#FFFFFF",
          text: "#2C2C2C",
          textMuted: "#888888",
        },
        typography: {
          heading: {
            family: "Playfair Display",
            weight: "700",
            sizes: { xl: "3rem" },
          },
          body: { family: "Lora", weight: "400", sizes: { md: "1rem" } },
        },
        spacing: { section: "5rem", element: "1.5rem", page: "2rem" },
        border: { radius: "4px", width: "1px", color: "#C4A882" },
        shadow: {
          sm: "0 1px 3px rgba(0,0,0,0.1)",
          md: "0 4px 12px rgba(0,0,0,0.1)",
          lg: "0 8px 24px rgba(0,0,0,0.15)",
        },
        animation: {
          duration: "600ms",
          easing: "ease-in-out",
          stagger: "100ms",
        },
      },
    }),
  };

  return {
    r2: {
      get: async (key: string) => store[key] ?? "{}",
      put: async (key: string, body: string) => {
        store[key] = body;
      },
    },
    db: {
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    },
    cfApiToken: "test-token",
    cfZoneId: "test-zone",
  };
}

describe("Build Pipeline", () => {
  it("produces valid HTML for a 1-page minimal project", async () => {
    const result = await runPipeline(
      {
        buildId: "test-build-1",
        projectId: "p1",
        tenantId: "t1",
        publishVersion: 1,
        sourceEditRevision: 1,
        documentR2Key: "projects/t1/p1/document.json",
        slug: "minh-va-lan",
        startedAt: Date.now(),
      },
      mockDeps() as any,
    );

    expect(result.htmlFiles["index.html"]).toContain("<!DOCTYPE html>");
    expect(result.htmlFiles["index.html"]).toContain("<html");
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThan(60_000);
  });

  it("HTML includes CSS custom properties (theme tokens)", async () => {
    const result = await runPipeline(
      {
        buildId: "test-build-2",
        projectId: "p1",
        tenantId: "t1",
        publishVersion: 1,
        sourceEditRevision: 1,
        documentR2Key: "projects/t1/p1/document.json",
        slug: "minh-va-lan",
        startedAt: Date.now(),
      },
      mockDeps() as any,
    );

    expect(result.htmlFiles["index.html"]).toContain("--color-primary");
  });

  it("HTML includes wedding couple data", async () => {
    const result = await runPipeline(
      {
        buildId: "test-build-3",
        projectId: "p1",
        tenantId: "t1",
        publishVersion: 1,
        sourceEditRevision: 1,
        documentR2Key: "projects/t1/p1/document.json",
        slug: "minh-va-lan",
        startedAt: Date.now(),
      },
      mockDeps() as any,
    );

    const html = result.htmlFiles["index.html"];
    expect(html).toContain("Minh");
    expect(html).toContain("Lan");
  });
});
