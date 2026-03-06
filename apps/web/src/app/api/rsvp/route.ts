import { NextResponse, type NextRequest } from "next/server";
import { SupabaseAdminDb } from "../../../server/supabase-admin-db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public RSVP API — no auth required (for guest forms on public invitation pages)
export async function POST(request: NextRequest) {
    let body: {
        projectId: string;
        guestName: string;
        email?: string;
        attending: boolean;
        partySize?: number;
        dietaryNotes?: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.projectId || !body.guestName || body.attending === undefined) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supa = new SupabaseAdminDb(SUPABASE_URL, SVC_KEY);

    try {
        // Verify project exists
        const project = await supa.findFirst<{ id: string; tenant_id: string; title: string }>(
            "projects",
            { id: body.projectId },
        );
        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Insert RSVP
        await supa.insert("rsvp_responses", {
            project_id: body.projectId,
            guest_name: body.guestName,
            email: body.email ?? null,
            attending: body.attending,
            party_size: body.partySize ?? 1,
            dietary_notes: body.dietaryNotes ?? null,
            is_over_quota: false,
        });

        // Send email notification to project owner (non-blocking)
        try {
            const owner = await supa.findFirst<{ email: string }>("users", {
                tenant_id: project.tenant_id,
            });
            if (owner?.email && process.env.RESEND_API_KEY) {
                // Fire and forget — don't block response
                fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/notify`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-key": process.env.INTERNAL_KEY ?? "",
                    },
                    body: JSON.stringify({
                        type: "rsvp_received",
                        to: owner.email,
                        data: {
                            guestName: body.guestName,
                            attending: body.attending,
                            partySize: body.partySize ?? 1,
                            projectTitle: project.title,
                        },
                    }),
                }).catch(() => { }); // Silent fail
            }
        } catch {
            // Non-fatal
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[api/rsvp] Insert failed:", err);
        return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
    }
}
