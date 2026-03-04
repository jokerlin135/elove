import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { MediaService } from "./media.service";

export const mediaRouter = router({
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string(),
        sizeBytes: z.number().positive(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const service = new MediaService(ctx.db, ctx.r2);
      return service.getUploadUrl({ tenantId: ctx.tenantId, ...input });
    }),

  confirmUpload: protectedProcedure
    .input(z.object({ mediaId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const service = new MediaService(ctx.db, ctx.r2);
      return service.confirmUpload({ mediaId: input.mediaId, tenantId: ctx.tenantId });
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      const service = new MediaService(ctx.db, ctx.r2);
      return service.list(ctx.tenantId, input.projectId);
    }),
});
