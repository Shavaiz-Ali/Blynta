import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MyClipsClient } from "@/features/dashboard/components/MyClipsClient";

export const dynamic = "force-dynamic";

export default async function MyClipsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <MyClipsClient />;
}
