import { createHash } from "crypto";
import type { BuildJob, PipelineDeps } from "./types.js";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function step12Upload(
  job: BuildJob,
  htmlFiles: Record<string, string>,
  deferredCss: string,
  jsBundleContent: string,
  _islandScripts: Record<string, string>,
  deps: PipelineDeps,
): Promise<void> {
  const prefix = `published/${job.projectId}/v${job.publishVersion}`;

  const uploads: Promise<void>[] = [];

  // HTML files — short cache so updates are served quickly
  for (const [name, html] of Object.entries(htmlFiles)) {
    uploads.push(
      deps.r2.put(`${prefix}/${name}`, html, {
        contentType: "text/html; charset=utf-8",
        cacheControl: "public, max-age=300",
      }),
    );
  }

  // CSS — content-hashed, immutable cache
  if (deferredCss) {
    const cssHash = sha256Hex(deferredCss).slice(0, 8);
    uploads.push(
      deps.r2.put(`${prefix}/style.${cssHash}.css`, deferredCss, {
        contentType: "text/css",
        cacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  // JS bundle — content-hashed, immutable cache
  if (jsBundleContent) {
    const jsHash = sha256Hex(jsBundleContent).slice(0, 8);
    uploads.push(
      deps.r2.put(`${prefix}/shared.${jsHash}.js`, jsBundleContent, {
        contentType: "application/javascript",
        cacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  await Promise.all(uploads);

  // CF Cache Purge (AD-14) — only in production, skip for test tokens
  if (deps.cfZoneId !== "test-zone" && deps.cfApiToken !== "test-token") {
    const urlsToPurge = Object.keys(htmlFiles).map(
      (name) =>
        `https://${job.slug}.elove.me/${name === "index.html" ? "" : name.replace(".html", "")}`,
    );
    await purgeCfCache(urlsToPurge, deps.cfZoneId, deps.cfApiToken);
  }
}

async function purgeCfCache(
  urls: string[],
  zoneId: string,
  token: string,
): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    },
  );
}
