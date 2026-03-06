import { NextResponse, type NextRequest } from "next/server";
import { SupabaseAdminDb } from "../../../server/supabase-admin-db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public Guestbook API — no auth required
export async function POST(request: NextRequest) {
    let body: {
        projectId: string;
        authorName: string;
        message: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.projectId || !body.authorName || !body.message) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Sanitize message
    const message = body.message.trim().slice(0, 500);
    if (message.length < 2) {
        return NextResponse.json({ error: "Message too short" }, { status: 400 });
    }

    const supa = new SupabaseAdminDb(SUPABASE_URL, SVC_KEY);

    try {
        // Verify project exists
        const project = await supa.findFirst<{ id: string }>("projects", { id: body.projectId });
        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        await supa.insert("guestbook_entries", {
            project_id: body.projectId,
            author_name: body.authorName.trim().slice(0, 100),
            message,
            is_approved: false,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[api/guestbook] Insert failed:", err);
        return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }
}
