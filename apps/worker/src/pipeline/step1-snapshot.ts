import type { BuildJob, PipelineDeps } from "./types.js";
import type { ProjectDocument, Theme } from "@elove/shared";

export async function step1Snapshot(
  job: BuildJob,
  deps: PipelineDeps,
): Promise<{ document: ProjectDocument; theme: Theme }> {
  const themeKey = job.documentR2Key.replace("document.json", "theme.json");

  const [docRaw, themeRaw] = await Promise.all([
    deps.r2.get(job.documentR2Key),
    deps.r2.get(themeKey),
  ]);

  return {
    document: JSON.parse(docRaw) as ProjectDocument,
    theme: JSON.parse(themeRaw) as Theme,
  };
}
