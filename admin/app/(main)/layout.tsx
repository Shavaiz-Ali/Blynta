"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { AdminSidebar } from "@/components/common/AdminSidebar";
import { AppSpinner } from "@/components/common/AppSpinner";
import { AppButton } from "@/components/common/AppButton";
import { ShieldAlert } from "lucide-react";

export default function MainAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isChecking = status === "loading";
  const isAuthenticated = status === "authenticated";
  const isAdmin = session?.user?.role === "admin";

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <AppSpinner size="lg" />
        <span className="text-xs text-muted-foreground font-medium animate-pulse">
          Authenticating administrator...
        </span>
      </div>
    );
  }

  if (isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="max-w-md w-full p-6 text-center rounded-xl border border-destructive/20 bg-card shadow-lg space-y-4">
          <div className="mx-auto size-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="size-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Access Denied</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your account (<strong>{session?.user?.email}</strong>) does not have administrative privileges. Please log in with an administrator account to access this console.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign Out & Switch Account
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto h-screen p-4 md:p-8 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}
