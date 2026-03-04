import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectsService } from "../projects.service";

// Mock DB
function createMockDb() {
  return {
    query: {
      projects: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      templates: {
        findFirst: vi.fn(async () => ({
          id: "tmpl-1",
          status: "published",
          current_version: 1,
          r2_bundle_key: "templates/elegant/v1/bundle.json",
        })),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  };
}

// Mock R2
function createMockR2() {
  const store: Record<string, string> = {
    "templates/elegant/v1/bundle.json": JSON.stringify({
      document: {
        schema_version: 1,
        structure: {
          pages: [{ id: "p1", slug: "home", title: "Home", sections: [] }],
          globalSlots: { navigation: null, musicPlayer: null, footer: null },
        },
        content: {
          data: {
            couple: {
              partner1: "",
              partner2: "",
              weddingDate: "",
              venue: "",
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
      },
      theme: { baseThemeId: "elegant", tokens: {}, overrides: {} },
    }),
  };

  return {
    put: vi.fn(async (path: string, body: string) => {
      store[path] = body;
    }),
    get: vi.fn(async (path: string) => store[path] ?? "{}"),
    presignUpload: vi.fn(),
    key: (p: string) => `elove/${p}`,
  };
}

describe("ProjectsService", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockR2: ReturnType<typeof createMockR2>;
  let service: ProjectsService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockR2 = createMockR2();
    service = new ProjectsService(mockDb as any, mockR2 as any);
  });

  it("creates project — writes 2 files to R2 and inserts to DB", async () => {
    const result = await service.create({
      tenantId: "tenant-1",
      templateId: "tmpl-1",
      title: "Tiệc cưới Minh & Lan",
      slug: "minh-va-lan",
    });

    expect(result.projectId).toBeDefined();
    expect(result.slug).toBe("minh-va-lan");
    expect(mockR2.put).toHaveBeenCalledTimes(2); // document.json + theme.json
  });

  it("rejects duplicate slug", async () => {
    mockDb.query.projects.findFirst.mockResolvedValueOnce({
      id: "existing",
    } as any);
    await expect(
      service.create({
        tenantId: "t1",
        templateId: "tmpl-1",
        title: "A",
        slug: "taken-slug",
      }),
    ).rejects.toThrow("Slug đã được sử dụng");
  });

  it("checkSlug returns available=true for unused slug", async () => {
    const result = await service.checkSlug("fresh-slug");
    expect(result.available).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });

  it("checkSlug returns suggestions for taken slug", async () => {
    mockDb.query.projects.findFirst.mockResolvedValueOnce({
      id: "existing",
    } as any);
    const result = await service.checkSlug("taken");
    expect(result.available).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
