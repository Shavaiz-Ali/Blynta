/** Activity's existing presentation, shared with other account record lists. */
export const recordListClasses = {
  container:
    "rounded-lg border border-border/70 bg-card/70 backdrop-blur-sm shadow-xs overflow-hidden transition-opacity duration-200 block p-0",
  toolbar:
    "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 p-3 sm:p-3.5 rounded-lg border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs",
  rowPadding: "px-4 py-3.5 sm:px-5 sm:py-4",
  neutralBadge:
    "bg-muted text-muted-foreground border-border/60 text-[11px] font-medium px-2 py-0.5",
} as const;
