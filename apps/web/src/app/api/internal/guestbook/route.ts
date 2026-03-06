import { NextResponse, type NextRequest } from "next/server";
import { SupabaseAdminDb } from "../../../../server/supabase-admin-db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    let body: {
        slug: string;
        name: string;
        message: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.slug || !body.name || !body.message) {
        return NextResponse.json(
            { error: "Missing required fields: slug, name, message" },
            { status: 400 },
        );
    }

    // Rate limit: max 500 chars
    if (body.message.length > 500) {
        return NextResponse.json(
            { error: "Message too long" },
            { status: 400 },
        );
    }

    const supa = new SupabaseAdminDb(SUPABASE_URL, SVC_KEY);

    try {
        // Lookup project by slug
        const projects = await supa.findMany<{ id: string }>("projects", { slug: body.slug });
        if (!projects || projects.length === 0) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        const projectId = projects[0].id;

        await supa.insert("guestbook_entries", {
            project_id: projectId,
            guest_name: body.name,
            message: body.message,
            is_approved: false,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[internal/guestbook] Insert failed:", err);
        return NextResponse.json(
            { error: "Failed to save guestbook entry" },
            { status: 500 },
        );
    }
}
