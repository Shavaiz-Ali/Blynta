import type { ReactNode } from "react";

export function AppPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-6">
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
