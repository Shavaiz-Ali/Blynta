import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardHome } from "@/features/dashboard/components/DashboardHome";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardHome />;
}
