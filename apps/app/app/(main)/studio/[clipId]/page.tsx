import { StudioWorkspace } from "@/features/ai-editor/StudioWorkspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ clipId: string }>;
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { clipId } = await params;
  const { jobId } = await searchParams;
  return (
    <StudioWorkspace
      key={`${jobId}-${clipId}`}
      clipId={clipId}
      jobId={jobId ?? ""}
    />
  );
}
