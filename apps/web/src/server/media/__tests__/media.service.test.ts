import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaService } from "../media.service";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];

function createMockDb() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    execute: vi.fn(() => Promise.resolve()),
    query: {
      media: {
        findFirst: vi.fn().mockResolvedValue({
          id: "media-1",
          tenant_id: "t1",
          r2_key: "media/t1/media-1/original.jpg",
          mime_type: "image/jpeg",
          size_bytes: 1024 * 1024,
        }),
      },
    },
  };
}

function createMockR2() {
  return {
    presignUpload: vi.fn().mockResolvedValue("https://r2.example.com/presigned-url"),
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue("{}"),
    key: (p: string) => `elove/${p}`,
  };
}

describe("MediaService", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockR2: ReturnType<typeof createMockR2>;
  let service: MediaService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockR2 = createMockR2();
    service = new MediaService(mockDb as any, mockR2 as any);
  });

  it("getUploadUrl returns presigned URL and mediaId", async () => {
    const result = await service.getUploadUrl({
      tenantId: "t1",
      projectId: "p1",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024 * 1024,
    });
    expect(result.uploadUrl).toContain("presigned");
    expect(result.mediaId).toBeDefined();
    expect(mockR2.presignUpload).toHaveBeenCalledTimes(1);
  });

  it.each(ALLOWED_MIMES)("accepts allowed mime type: %s", async (mimeType) => {
    const ext = mimeType.split("/")[1];
    const result = await service.getUploadUrl({
      tenantId: "t1", projectId: "p1",
      filename: `file.${ext}`, mimeType, sizeBytes: 100,
    });
    expect(result.mediaId).toBeDefined();
  });

  it("rejects unsupported mime types", async () => {
    await expect(
      service.getUploadUrl({
        tenantId: "t1", projectId: "p1",
        filename: "file.exe", mimeType: "application/exe", sizeBytes: 100,
      })
    ).rejects.toThrow("Định dạng file không được hỗ trợ");
  });

  it("rejects files over 100MB", async () => {
    await expect(
      service.getUploadUrl({
        tenantId: "t1", projectId: "p1",
        filename: "big.jpg", mimeType: "image/jpeg", sizeBytes: 101 * 1024 * 1024,
      })
    ).rejects.toThrow("File quá lớn");
  });

  it("getUploadUrl pre-inserts a media record", async () => {
    await service.getUploadUrl({
      tenantId: "t1", projectId: "p1",
      filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1024,
    });
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("confirmUpload queues variant generation", async () => {
    const variantFn = vi.fn();
    service.setVariantQueue(variantFn);
    await service.confirmUpload({ mediaId: "media-1", tenantId: "t1" });
    expect(variantFn).toHaveBeenCalledWith("media-1");
  });
});
