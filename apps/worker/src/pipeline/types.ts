export interface BuildJob {
  buildId: string;
  projectId: string;
  tenantId: string;
  publishVersion: number;
  sourceEditRevision: number;
  documentR2Key: string;
  slug: string;
  startedAt: number;
}

export interface PipelineDeps {
  r2: {
    get: (key: string) => Promise<string>;
    put: (
      key: string,
      body: string,
      opts?: { contentType?: string; cacheControl?: string },
    ) => Promise<void>;
  };
  db: {
    update: (table: unknown) => {
      set: (values: unknown) => { where: (cond: unknown) => Promise<void> };
    };
  };
  cfApiToken: string;
  cfZoneId: string;
}

export interface PipelineResult {
  htmlFiles: Record<string, string>;
  durationMs: number;
}
