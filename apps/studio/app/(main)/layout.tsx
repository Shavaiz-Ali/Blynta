import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProtectedStudio } from "@/features/auth/components/ProtectedStudio";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ProtectedStudio>{children}</ProtectedStudio>;
}
