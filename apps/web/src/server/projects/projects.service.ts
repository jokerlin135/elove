import { randomUUID } from "crypto";
import type { SupabaseAdminDb } from "../supabase-admin-db";
import type { R2Client } from "../r2";

type Project = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  template_id: string;
  template_version: number;
  r2_document_key: string;
  status: string;
  edit_revision: number;
  updated_at: string;
};

type Template = {
  id: string;
  status: string;
  current_version: number;
  r2_bundle_key: string;
};

export class ProjectsService {
  constructor(
    private readonly supa: SupabaseAdminDb,
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
    const existing = await this.supa.findFirst<Project>("projects", { slug });
    if (existing) throw new Error("Slug đã được sử dụng");

    // 2. Fetch template metadata
    const template = await this.supa.findFirst<Template>("templates", {
      id: templateId,
      status: "published",
    });
    if (!template) throw new Error("Template không tồn tại");

    // 3. Fetch template bundle from R2
    const bundleRaw = await this.r2.get(template.r2_bundle_key);
    let bundle: { document: Record<string, unknown>; theme: unknown };
    try {
      bundle = JSON.parse(bundleRaw);
    } catch {
      throw new Error("Bundle template không hợp lệ");
    }

    // 4. Create project files in R2
    const projectId = randomUUID();
    const documentPath = `projects/${tenantId}/${projectId}/document.json`;
    const themePath = `projects/${tenantId}/${projectId}/theme.json`;

    await Promise.all([
      this.r2.put(
        documentPath,
        JSON.stringify({ ...bundle.document, schema_version: 1 }),
        { contentType: "application/json" },
      ),
      this.r2.put(themePath, JSON.stringify(bundle.theme), {
        contentType: "application/json",
      }),
    ]);

    // 5. Insert project row
    await this.supa.insert("projects", {
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
    const existing = await this.supa.findFirst("projects", { slug });
    if (!existing) return { available: true, suggestions: [] as string[] };
    const rand = Math.random().toString(36).slice(2, 6);
    return {
      available: false,
      suggestions: [`${slug}-2026`, `${slug}-wedding`, `${slug}-${rand}`],
    };
  }

  async get(projectId: string, tenantId: string) {
    const project = await this.supa.findFirst<Project>("projects", {
      id: projectId,
      tenant_id: tenantId,
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
    return this.supa.findMany<Project>(
      "projects",
      { tenant_id: tenantId },
      "updated_at",
    );
  }

  async archive(projectId: string, tenantId: string) {
    await this.supa.update(
      "projects",
      { id: projectId, tenant_id: tenantId },
      { status: "archived" },
    );
  }

  async update(
    projectId: string,
    tenantId: string,
    payload: {
      documentJson: string;
      themeJson: string;
      editRevision: number;
    },
  ) {
    const project = await this.supa.findFirst<Project>("projects", {
      id: projectId,
      tenant_id: tenantId,
    });
    if (!project) throw new Error("Project không tìm thấy");

    const themePath = `projects/${tenantId}/${projectId}/theme.json`;
    await Promise.all([
      this.r2.put(project.r2_document_key, payload.documentJson, {
        contentType: "application/json",
      }),
      this.r2.put(themePath, payload.themeJson, {
        contentType: "application/json",
      }),
    ]);

    await this.supa.update(
      "projects",
      { id: projectId, tenant_id: tenantId },
      {
        edit_revision: payload.editRevision,
        updated_at: new Date().toISOString(),
      },
    );

    return { ok: true };
  }
}
