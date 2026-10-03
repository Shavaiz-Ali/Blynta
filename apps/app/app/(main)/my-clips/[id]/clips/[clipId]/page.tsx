import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClipDetailView } from "@/features/jobs";

export const dynamic = "force-dynamic";

export default async function ClipStudioPage({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id, clipId } = await params;

  return <ClipDetailView jobId={id} clipId={clipId} />;
}
