import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SourceVideoDetails } from "@/features/jobs";

export const dynamic = "force-dynamic";

export default async function SourceVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return <SourceVideoDetails jobId={id} />;
}
