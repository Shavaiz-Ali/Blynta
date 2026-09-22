import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LegacyJobClipDetailPage({
  params,
}: {
  params: Promise<{ id: string; clipId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id, clipId } = await params;
  redirect(`/my-clips/${id}/clips/${clipId}`);
}
