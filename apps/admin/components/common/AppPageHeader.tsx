import type { ReactNode } from "react";

export function AppPageHeader({
  title,
  description,
  action,
  eyebrow = "Administration",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-6">
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground flex items-baseline">
          {title}
          <span className="text-primary font-serif font-normal ml-0.5">.</span>
        </h1>
        {description && (
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2.5">{action}</div>}
    </header>
  );
}
