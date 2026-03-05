import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectsService } from "../projects.service";

// Mock SupabaseAdminDb
function createMockSupa() {
  return {
    findFirst: vi.fn().mockResolvedValue(null as any),
    findMany: vi.fn().mockResolvedValue([] as any),
    insert: vi.fn().mockResolvedValue(undefined),
    insertIgnore: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
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
  let mockSupa: ReturnType<typeof createMockSupa>;
  let mockR2: ReturnType<typeof createMockR2>;
  let service: ProjectsService;

  beforeEach(() => {
    mockSupa = createMockSupa();
    mockR2 = createMockR2();
    // findFirst for templates returns a template on second call (first call is slug check)
    mockSupa.findFirst
      .mockResolvedValueOnce(null) // slug check → not taken
      .mockResolvedValueOnce({
        // template lookup → found
        id: "tmpl-1",
        status: "published",
        current_version: 1,
        r2_bundle_key: "templates/elegant/v1/bundle.json",
      });
    service = new ProjectsService(mockSupa as any, mockR2 as any);
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
    expect(mockSupa.insert).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate slug", async () => {
    // Reset and make findFirst return existing project for slug check
    mockSupa.findFirst.mockReset();
    mockSupa.findFirst.mockResolvedValueOnce({ id: "existing" } as any);

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
    mockSupa.findFirst.mockReset();
    mockSupa.findFirst.mockResolvedValueOnce(null);

    const result = await service.checkSlug("fresh-slug");
    expect(result.available).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });

  it("checkSlug returns suggestions for taken slug", async () => {
    mockSupa.findFirst.mockReset();
    mockSupa.findFirst.mockResolvedValueOnce({ id: "existing" } as any);

    const result = await service.checkSlug("taken");
    expect(result.available).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
