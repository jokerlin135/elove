import { randomUUID } from "crypto";
import { projects } from "@elove/shared";
import type { Db } from "@elove/shared";
import type { R2Client } from "../r2";

export class ProjectsService {
  constructor(
    private readonly db: Db,
    private readonly r2: R2Client,
  ) {}

  async create({
    tenantId,
    templateId,
    title,
    slug,
  }: {
    tenantId: string;
    templateId: string;
    title: string;
    slug: string;
  }) {
    // 1. Check slug uniqueness
    const existing = await this.db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.slug, slug),
    });
    if (existing) throw new Error("Slug đã được sử dụng");

    // 2. Fetch template metadata from DB
    const template = await this.db.query.templates.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.id, templateId), eq(t.status, "published")),
    });
    if (!template) throw new Error("Template không tồn tại");

    // 3. Fetch template bundle from R2
    const bundleRaw = await this.r2.get(template.r2_bundle_key);
    const bundle = JSON.parse(bundleRaw);

    // 4. Deep-copy document + theme from bundle
    const projectId = randomUUID();
    const documentPath = `projects/${tenantId}/${projectId}/document.json`;
    const themePath = `projects/${tenantId}/${projectId}/theme.json`;

    // 5. Write both files to R2
    await this.r2.put(
      documentPath,
      JSON.stringify({ ...bundle.document, schema_version: 1 }),
      { contentType: "application/json" },
    );
    await this.r2.put(
      themePath,
      JSON.stringify(bundle.theme),
      { contentType: "application/json" },
    );

    // 6. Insert project row to DB
    await this.db.insert(projects).values({
      id: projectId,
      tenant_id: tenantId,
      slug,
      title,
      template_id: templateId,
      template_version: template.current_version,
      r2_document_key: documentPath,
    });

    return { projectId, slug, r2DocumentKey: documentPath };
  }

  async checkSlug(slug: string) {
    const existing = await this.db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.slug, slug),
    });
    if (!existing) return { available: true, suggestions: [] as string[] };

    const rand = Math.random().toString(36).slice(2, 6);
    const suggestions = [`${slug}-2026`, `${slug}-wedding`, `${slug}-${rand}`];
    return { available: false, suggestions };
  }

  async get(projectId: string, tenantId: string) {
    const project = await this.db.query.projects.findFirst({
      where: (p, { eq, and }) =>
        and(eq(p.id, projectId), eq(p.tenant_id, tenantId)),
    });
    if (!project) throw new Error("Project không tìm thấy");

    const [docRaw, themeRaw] = await Promise.all([
      this.r2.get(project.r2_document_key),
      this.r2.get(`projects/${tenantId}/${projectId}/theme.json`),
    ]);

    return {
      project,
      document: JSON.parse(docRaw),
      theme: JSON.parse(themeRaw),
    };
  }

  async list(tenantId: string) {
    return this.db.query.projects.findMany({
      where: (p, { eq }) => eq(p.tenant_id, tenantId),
      orderBy: (p, { desc }) => [desc(p.updated_at)],
    });
  }

  async archive(projectId: string, tenantId: string) {
    const { eq, and } = await import("drizzle-orm");
    await this.db
      .update(projects)
      .set({ status: "archived" })
      .where(and(eq(projects.id, projectId), eq(projects.tenant_id, tenantId)));
  }
}
