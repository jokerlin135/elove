import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { runPipeline } from "./pipeline/index.js";
import type { PipelineDeps } from "./pipeline/index.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PREFIX = process.env.R2_PREFIX ?? "elove";

const deps: PipelineDeps = {
  r2: {
    async get(path: string): Promise<string> {
      const cmd = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: `${R2_PREFIX}/${path}`,
      });
      const res = await s3.send(cmd);
      return res.Body!.transformToString();
    },
    async put(
      path: string,
      body: string,
      opts?: { contentType?: string; cacheControl?: string },
    ): Promise<void> {
      const cmd = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: `${R2_PREFIX}/${path}`,
        Body: body,
        ContentType: opts?.contentType,
        CacheControl: opts?.cacheControl,
      });
      await s3.send(cmd);
    },
  },
  // Supabase client satisfies db interface at call-site; cast as any here
  // because the polling loop uses the full supabase client directly.
  db: supabase as unknown as PipelineDeps["db"],
  cfApiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
  cfZoneId: process.env.CLOUDFLARE_ZONE_ID ?? "",
};

async function pollAndProcess(): Promise<void> {
  // Claim a queued job using a PostgreSQL function with FOR UPDATE SKIP LOCKED
  const { data: jobs, error } = await supabase.rpc("claim_build_job");

  if (error || !jobs || jobs.length === 0) return;

  const job = jobs[0] as {
    id: string;
    project_id: string;
    tenant_id: string;
    publish_version: number;
    source_edit_revision: number;
    document_r2_key: string;
    project_slug: string;
  };

  console.log(`[worker] Processing build job: ${job.id}`);

  try {
    await supabase
      .from("build_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", job.id);

    await runPipeline(
      {
        buildId: job.id,
        projectId: job.project_id,
        tenantId: job.tenant_id,
        publishVersion: job.publish_version,
        sourceEditRevision: job.source_edit_revision,
        documentR2Key: job.document_r2_key,
        slug: job.project_slug ?? job.project_id,
        startedAt: Date.now(),
      },
      deps,
    );

    await supabase
      .from("build_jobs")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", job.id);

    console.log(`[worker] Build job done: ${job.id}`);
  } catch (err) {
    console.error(`[worker] Build job failed: ${job.id}`, err);
    await supabase
      .from("build_jobs")
      .update({ status: "failed", error_message: String(err) })
      .eq("id", job.id);
  }
}

async function main(): Promise<void> {
  console.log("[worker] ELove Build Worker started, polling every 5s...");

  while (true) {
    try {
      await pollAndProcess();
    } catch (err) {
      console.error("[worker] Poll error:", err);
    }
    await new Promise<void>((r) => setTimeout(r, 5000));
  }
}

main().catch(console.error);
