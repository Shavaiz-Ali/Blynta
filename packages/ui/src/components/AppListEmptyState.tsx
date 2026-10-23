import type { ReactNode } from "react";

/** Presentation extracted from Activity; actions and domain copy stay with the caller. */
export function AppListEmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted/70 border border-border/60 flex items-center justify-center mb-3.5 shadow-2xs">
        {icon}
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
        {description}
      </p>
      {children}
    </div>
  );
}
