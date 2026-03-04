import { EditorLayout } from "../../../components/editor/EditorLayout";

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;
  return <EditorLayout projectId={projectId} />;
}

export const metadata = {
  title: "Editor — ELove",
};
