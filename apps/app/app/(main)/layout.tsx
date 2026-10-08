import { ProductSessionBoundary } from "@blynta/auth/session-expired";
import { productSignInDestination } from "@blynta/auth/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect(await productSignInDestination());
  return (
    <ProductSessionBoundary initialSession={session}>
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </ProductSessionBoundary>
  );
}
