import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ProjectsService } from "./projects.service";

const createInput = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang"),
});

export const projectsRouter = router({
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.supa, ctx.r2);
      return service.create({ tenantId: ctx.tenantId, ...input });
    }),

  checkSlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.supa, ctx.r2);
      return service.checkSlug(input.slug);
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.supa, ctx.r2);
      return service.get(input.projectId, ctx.tenantId);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const service = new ProjectsService(ctx.supa, ctx.r2);
    return service.list(ctx.tenantId);
  }),

  archive: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.supa, ctx.r2);
      return service.archive(input.projectId, ctx.tenantId);
    }),

  update: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        documentJson: z.string(),
        themeJson: z.string(),
        editRevision: z.number().int().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = new ProjectsService(ctx.supa, ctx.r2);
      return service.update(input.projectId, ctx.tenantId, {
        documentJson: input.documentJson,
        themeJson: input.themeJson,
        editRevision: input.editRevision,
      });
    }),
});
