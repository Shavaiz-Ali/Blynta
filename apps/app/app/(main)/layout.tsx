import { ProductSessionBoundary } from "@blynta/auth/session-expired";
import { productSignInDestination } from "@blynta/auth/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect(await productSignInDestination());
  return (
    <ProductSessionBoundary initialSession={session}>
      <AppShell>{children}</AppShell>
    </ProductSessionBoundary>
  );
}
