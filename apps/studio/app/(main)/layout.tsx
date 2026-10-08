import { ProductSessionBoundary } from "@blynta/auth/session-expired";
import { productSignInDestination } from "@blynta/auth/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProtectedStudio } from "@/features/auth/components/ProtectedStudio";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect(await productSignInDestination());
  return (
    <ProductSessionBoundary initialSession={session}>
      <ProtectedStudio>{children}</ProtectedStudio>
    </ProductSessionBoundary>
  );
}
