import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupabaseAdminDb } from "../../../server/supabase-admin-db";
import InvitationPage from "./InvitationPage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ProjectRow = {
    id: string;
    title: string;
    slug: string;
    status: string;
    document_json: string;
    theme_json: string;
};

type Props = {
    params: Promise<{ slug: string }>;
};

async function getProject(slug: string) {
    const supa = new SupabaseAdminDb(SUPABASE_URL, SVC_KEY);
    const projects = await supa.findMany<ProjectRow>("projects", { slug });
    const project = projects.find((p) => p.status === "published");
    return project ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const project = await getProject(slug);

    const title = project?.title ?? "Thiệp mời cưới — ELove";
    const description = "Bạn được mời! Xem thiệp cưới online và gửi lời chúc tới cặp đôi.";

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            siteName: "ELove",
            type: "website",
            url: `https://elove.me/${slug}`,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
    };
}

export default async function PublicInvitationPage({ params }: Props) {
    const { slug } = await params;
    const project = await getProject(slug);

    if (!project) {
        notFound();
    }

    let doc = null;
    try {
        doc = JSON.parse(project.document_json || "null");
    } catch {
        doc = null;
    }

    return (
        <InvitationPage
            projectId={project.id}
            slug={slug}
            title={project.title}
            doc={doc}
        />
    );
}
