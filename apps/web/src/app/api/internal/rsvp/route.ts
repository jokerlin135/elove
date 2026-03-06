import { NextResponse, type NextRequest } from "next/server";
import { SupabaseAdminDb } from "../../../../server/supabase-admin-db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INTERNAL_KEY = process.env.INTERNAL_KEY!;

export async function POST(request: NextRequest) {
    // Verify internal key
    const authKey = request.headers.get("x-internal-key");
    if (!authKey || authKey !== INTERNAL_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
        projectId: string;
        guestName: string;
        email?: string;
        attending: boolean;
        partySize: number;
        dietaryNotes?: string;
        isOverQuota: boolean;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.projectId || !body.guestName || body.attending === undefined) {
        return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 },
        );
    }

    const supa = new SupabaseAdminDb(SUPABASE_URL, SVC_KEY);

    try {
        await supa.insert("rsvp_responses", {
            project_id: body.projectId,
            guest_name: body.guestName,
            email: body.email ?? null,
            attending: body.attending,
            party_size: body.partySize ?? 1,
            dietary_notes: body.dietaryNotes ?? null,
            is_over_quota: body.isOverQuota ?? false,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[internal/rsvp] Insert failed:", err);
        return NextResponse.json(
            { error: "Failed to save RSVP" },
            { status: 500 },
        );
    }
}
