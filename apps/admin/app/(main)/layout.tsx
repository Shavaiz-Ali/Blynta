import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { AdminShell } from "@/components/layout/AdminShell";

export default async function MainAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const hasAdminAccess = can(session.user.role, "users.read");
  if (!hasAdminAccess || session.user.role !== "admin") redirect("/login");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <AdminShell>{children}</AdminShell>
    </>
  );
}
