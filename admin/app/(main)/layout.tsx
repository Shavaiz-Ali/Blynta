import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { AdminSidebar } from "@/components/common/AdminSidebar";
import { AdminTopbar } from "@/components/common/AdminTopbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
export default async function MainAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const hasAdminAccess = can(session.user.role, "users.read");

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <AdminSidebar />
      <SidebarInset className="min-h-dvh min-w-0 overflow-hidden bg-background md:h-svh">
        <AdminTopbar />
        <div id="main-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7">
            {hasAdminAccess ? children : (
              <section className="mx-auto max-w-lg py-16">
                <h1 className="text-xl font-semibold">Administrator access required</h1>
                <p className="mt-3 text-muted-foreground">
                  Your account does not have permission to use this console.
                </p>
              </section>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
