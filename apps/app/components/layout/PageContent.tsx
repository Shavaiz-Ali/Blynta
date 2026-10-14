import type { ReactNode } from "react";

/** Feature content only. Navigation and viewport sizing belong to AppShell. */
export function PageContent({
  children,
  toolbar,
  workspace = false,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  workspace?: boolean;
}) {
  return (
    <div
      className={
        workspace
          ? "h-full min-h-0 min-w-0 w-full"
          : "w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-8 py-6 lg:py-8 space-y-6"
      }
    >
      {toolbar && (
        <div className="min-w-0" aria-label="Page context">
          {toolbar}
        </div>
      )}
      {children}
    </div>
  );
}
