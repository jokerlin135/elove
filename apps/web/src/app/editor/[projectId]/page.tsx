import { TRPCProvider } from "../../../components/TRPCProvider";
import { EditorProvider } from "../../../components/editor/EditorProvider";
import { EditorLayout } from "../../../components/editor/EditorLayout";

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;
  return (
    <TRPCProvider>
      <EditorProvider projectId={projectId}>
        <EditorLayout projectId={projectId} />
      </EditorProvider>
    </TRPCProvider>
  );
}

export const metadata = { title: "Editor — ELove" };
