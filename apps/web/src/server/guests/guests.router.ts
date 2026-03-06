import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

type RsvpRow = {
    id: string;
    project_id: string;
    guest_name: string;
    email: string | null;
    attending: boolean;
    party_size: number;
    dietary_notes: string | null;
    is_over_quota: boolean;
    created_at: string;
};

type WishRow = {
    id: string;
    project_id: string;
    author_name: string;
    message: string;
    is_approved: boolean;
    created_at: string;
};

type GiftRow = {
    id: string;
    project_id: string;
    guest_name: string;
    amount: number;
    message: string | null;
    method: string;
    created_at: string;
};

export const guestsRouter = router({
    // ─── RSVP ─────────────────────────────────
    listRsvp: protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const rows = await ctx.supa.findMany<RsvpRow>("rsvp_responses", {
                project_id: input.projectId,
            });
            return rows.map((r) => ({
                id: r.id,
                guestName: r.guest_name,
                email: r.email,
                attending: r.attending,
                partySize: r.party_size,
                dietaryNotes: r.dietary_notes,
                createdAt: r.created_at,
            }));
        }),

    rsvpStats: protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const rows = await ctx.supa.findMany<RsvpRow>("rsvp_responses", {
                project_id: input.projectId,
            });
            const attending = rows.filter((r) => r.attending);
            const declined = rows.filter((r) => !r.attending);
            return {
                total: rows.length,
                attending: attending.length,
                declined: declined.length,
                totalGuests: attending.reduce((sum, r) => sum + r.party_size, 0),
            };
        }),

    // ─── WISHES (Guestbook) ───────────────────
    listWishes: protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const rows = await ctx.supa.findMany<WishRow>("guestbook_entries", {
                project_id: input.projectId,
            });
            return rows.map((w) => ({
                id: w.id,
                guestName: w.author_name,
                message: w.message,
                isApproved: w.is_approved,
                createdAt: w.created_at,
            }));
        }),

    approveWish: protectedProcedure
        .input(
            z.object({
                wishId: z.string().uuid(),
                approved: z.boolean(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await ctx.supa.update(
                "guestbook_entries",
                { id: input.wishId },
                { is_approved: input.approved },
            );
            return { success: true };
        }),

    // ─── GIFTS ────────────────────────────────
    listGifts: protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const rows = await ctx.supa.findMany<GiftRow>("gifts", {
                project_id: input.projectId,
            });
            return rows.map((g) => ({
                id: g.id,
                guestName: g.guest_name,
                amount: g.amount,
                message: g.message,
                method: g.method,
                createdAt: g.created_at,
            }));
        }),

    giftStats: protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const rows = await ctx.supa.findMany<GiftRow>("gifts", {
                project_id: input.projectId,
            });
            return {
                totalAmount: rows.reduce((sum, g) => sum + g.amount, 0),
                count: rows.length,
            };
        }),

    // ─── STATS ────────────────────────────────
    dashboardStats: protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
            const [rsvp, wishes, gifts] = await Promise.all([
                ctx.supa.findMany<RsvpRow>("rsvp_responses", {
                    project_id: input.projectId,
                }),
                ctx.supa.findMany<WishRow>("guestbook_entries", {
                    project_id: input.projectId,
                }),
                ctx.supa.findMany<GiftRow>("gifts", {
                    project_id: input.projectId,
                }),
            ]);

            return {
                rsvpCount: rsvp.length,
                attendingCount: rsvp.filter((r) => r.attending).length,
                totalGuests: rsvp
                    .filter((r) => r.attending)
                    .reduce((sum, r) => sum + r.party_size, 0),
                wishCount: wishes.length,
                giftCount: gifts.length,
                giftTotal: gifts.reduce((sum, g) => sum + g.amount, 0),
            };
        }),

    // ─── ALL STATS (across all user projects) ─────
    allStats: protectedProcedure
        .query(async ({ ctx }) => {
            // Get all user projects first
            type ProjectRow = { id: string; title: string; slug: string; status: string };
            const projects = await ctx.supa.findMany<ProjectRow>("projects", {
                tenant_id: ctx.tenantId,
            });

            // Aggregate stats across all projects
            let rsvpTotal = 0, attendingTotal = 0, wishTotal = 0, giftTotal = 0;

            for (const p of projects) {
                const [rsvp, wishes, gifts] = await Promise.all([
                    ctx.supa.findMany<RsvpRow>("rsvp_responses", { project_id: p.id }),
                    ctx.supa.findMany<WishRow>("guestbook_entries", { project_id: p.id }),
                    ctx.supa.findMany<GiftRow>("gifts", { project_id: p.id }),
                ]);
                rsvpTotal += rsvp.filter((r) => r.attending).length;
                attendingTotal += rsvp.length;
                wishTotal += wishes.length;
                giftTotal += gifts.length;
            }

            return {
                projectCount: projects.length,
                rsvpCount: rsvpTotal,
                wishCount: wishTotal,
                giftCount: giftTotal,
            };
        }),

    // ─── RECENT ACTIVITY (for NotificationPanel) ──
    recentActivity: protectedProcedure
        .query(async ({ ctx }) => {
            type ProjectRow = { id: string; title: string };
            const projects = await ctx.supa.findMany<ProjectRow>("projects", {
                tenant_id: ctx.tenantId,
            });

            type ActivityItem = {
                id: string;
                type: "rsvp" | "wish" | "gift";
                title: string;
                message: string;
                time: string;
            };
            const items: ActivityItem[] = [];

            for (const p of projects) {
                const [rsvps, wishes, gifts] = await Promise.all([
                    ctx.supa.findMany<RsvpRow>("rsvp_responses", { project_id: p.id }),
                    ctx.supa.findMany<WishRow>("guestbook_entries", { project_id: p.id }),
                    ctx.supa.findMany<GiftRow>("gifts", { project_id: p.id }),
                ]);

                for (const r of rsvps) {
                    items.push({
                        id: r.id,
                        type: "rsvp",
                        title: r.attending ? "RSVP xác nhận" : "RSVP từ chối",
                        message: `${r.guest_name} — ${p.title}`,
                        time: r.created_at,
                    });
                }
                for (const w of wishes) {
                    items.push({
                        id: w.id,
                        type: "wish",
                        title: "Lời chúc mới",
                        message: `${w.author_name}: "${w.message.slice(0, 40)}${w.message.length > 40 ? "…" : ""}"`,
                        time: w.created_at,
                    });
                }
                for (const g of gifts) {
                    items.push({
                        id: g.id,
                        type: "gift",
                        title: "Quà mừng",
                        message: `${g.guest_name} — ${g.amount.toLocaleString("vi-VN")}đ`,
                        time: g.created_at,
                    });
                }
            }

            // Sort by time desc, take 10
            items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return items.slice(0, 10);
        }),
});
