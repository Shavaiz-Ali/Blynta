import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClipsLibrary } from "@/features/jobs";

export const dynamic = "force-dynamic";

export default async function MyClipsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <ClipsLibrary />;
}
