import { productSignInDestination } from "@blynta/auth/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(await productSignInDestination());
  }

  const { id } = await params;
  redirect(`/my-clips/${id}`);
}
