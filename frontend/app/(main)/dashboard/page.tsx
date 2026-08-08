import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardShell />;
}
