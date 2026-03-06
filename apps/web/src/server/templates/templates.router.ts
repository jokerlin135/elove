import { z } from "zod";
import { router, publicProcedure } from "../trpc";

type TemplateRow = {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    thumbnail_url: string | null;
    status: string;
    plan_required: string;
    view_count: number;
    heart_count: number;
    created_at: string;
};

export const templatesRouter = router({
    list: publicProcedure
        .input(
            z
                .object({
                    category: z.string().optional(),
                })
                .optional(),
        )
        .query(async ({ input, ctx }) => {
            const filter: Record<string, unknown> = { status: "published" };
            if (input?.category) {
                filter.category = input.category;
            }

            const templates = await ctx.supa.findMany<TemplateRow>(
                "templates",
                filter,
            );

            return templates.map((t) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                category: t.category,
                description: t.description,
                thumbnailUrl: t.thumbnail_url,
                planRequired: t.plan_required,
                viewCount: t.view_count,
                heartCount: t.heart_count,
            }));
        }),

    get: publicProcedure
        .input(z.object({ templateId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const t = await ctx.supa.findFirst<TemplateRow>("templates", {
                id: input.templateId,
                status: "published",
            });

            if (!t) return null;

            // Increment view count (non-blocking)
            ctx.supa
                .update("templates", { id: t.id }, { view_count: t.view_count + 1 })
                .catch(() => { });

            return {
                id: t.id,
                name: t.name,
                slug: t.slug,
                category: t.category,
                description: t.description,
                thumbnailUrl: t.thumbnail_url,
                planRequired: t.plan_required,
                viewCount: t.view_count,
                heartCount: t.heart_count,
            };
        }),
});
