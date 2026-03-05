import { randomUUID } from "crypto";
import type { SupabaseAdminDb } from "../supabase-admin-db";
import type { R2Client } from "../r2";

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB hard limit

type MediaRow = {
  id: string;
  tenant_id: string;
  project_id: string;
  r2_key: string;
  mime_type: string;
  size_bytes: number;
  variants_ready: boolean;
  created_at: string;
};

export class MediaService {
  private variantQueue?: (mediaId: string) => void;

  constructor(
    private readonly supa: SupabaseAdminDb,
    private readonly r2: R2Client,
  ) {}

  setVariantQueue(fn: (mediaId: string) => void): void {
    this.variantQueue = fn;
  }

  async getUploadUrl({
    tenantId,
    projectId,
    filename,
    mimeType,
    sizeBytes,
  }: {
    tenantId: string;
    projectId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    if (!ALLOWED_MIMES.has(mimeType)) {
      throw new Error("Định dạng file không được hỗ trợ");
    }

    if (sizeBytes > MAX_FILE_SIZE) {
      throw new Error("File quá lớn (tối đa 100MB)");
    }

    const mediaId = randomUUID();
    const ext = filename.split(".").pop() ?? "bin";
    const r2Path = `media/${tenantId}/${mediaId}/original.${ext}`;

    // Presigned upload URL (valid 1 hour)
    const uploadUrl = await this.r2.presignUpload(r2Path, mimeType, 3600);

    // Pre-insert stub record
    await this.supa.insert("media", {
      id: mediaId,
      tenant_id: tenantId,
      project_id: projectId,
      r2_key: r2Path,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      variants_ready: false,
    });

    return { mediaId, uploadUrl, r2Key: r2Path };
  }

  async confirmUpload({
    mediaId,
    tenantId: _tenantId,
  }: {
    mediaId: string;
    tenantId: string;
  }) {
    // Queue async variant generation (AD-02: pre-generate on upload, not in build pipeline)
    this.variantQueue?.(mediaId);
    return { success: true };
  }

  async list(tenantId: string, projectId?: string) {
    if (projectId) {
      // Supabase REST doesn't support OR easily — use AND with both conditions
      return this.supa.findMany<MediaRow>(
        "media",
        { tenant_id: tenantId, project_id: projectId },
        "created_at",
      );
    }
    return this.supa.findMany<MediaRow>(
      "media",
      { tenant_id: tenantId },
      "created_at",
    );
  }
}
