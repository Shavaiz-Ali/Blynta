import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/features/dashboard";
import { JobDetailContent } from "@/features/jobs/components/JobDetail";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <DashboardLayout>
      <JobDetailContent jobId={id} />
    </DashboardLayout>
  );
}
