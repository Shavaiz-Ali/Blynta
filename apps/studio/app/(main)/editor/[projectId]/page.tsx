import { EditorShell } from "@/features/studio/editor/components/EditorShell";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <EditorShell projectId={projectId} />;
}
