import { AppSpinner } from "@blynta/ui";

export function EditorLoading() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background p-6"
      aria-busy="true"
    >
      <div
        role="status"
        className="flex flex-col items-center gap-3 text-center"
      >
        <AppSpinner size="lg" aria-hidden="true" className="text-primary" />
        <p className="text-sm font-medium">Loading your editor…</p>
        <p className="text-xs text-muted-foreground">
          Preparing your project and timeline.
        </p>
      </div>
    </main>
  );
}
