import Link from "next/link";
import { ArrowLeft, Film } from "lucide-react";
import { AppButton } from "@blynta/ui";
import { StudioLogo } from "@/components/common/StudioLogo";

export function EditorUnavailable({
  error,
  onRetry,
}: {
  error?: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex h-dvh gap-3 overflow-hidden bg-background p-3 text-foreground">
      <nav
        className="flex w-[72px] shrink-0 flex-col items-center rounded-xl border border-border bg-sidebar py-4"
        aria-label="Editor navigation"
      >
        <Link href="/dashboard" aria-label="Blynta projects">
          <StudioLogo collapsed />
        </Link>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <header className="flex h-12 shrink-0 items-center gap-3 rounded-xl border border-border bg-card px-3">
          <AppButton
            nativeButton={false}
            render={<Link href="/dashboard" />}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft />
            Back to projects
          </AppButton>
          <h1 className="truncate text-sm font-medium">
            {error ? "Unable to open project" : "Project not found"}
          </h1>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px] gap-3 max-[1099px]:grid-cols-[minmax(0,1fr)_300px] max-[979px]:grid-cols-1">
          <aside className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground max-[1099px]:hidden">
            Project tools
          </aside>
          <section
            className="flex min-w-0 items-center justify-center rounded-xl border border-border bg-card p-6 text-muted-foreground"
            aria-label="Video preview unavailable"
          >
            <Film className="size-8" />
          </section>
          <section className="overflow-auto rounded-xl border border-border bg-card p-4 max-[979px]:col-start-1">
            <h2 className="text-sm font-medium">Project unavailable</h2>
            <p
              role="alert"
              className="my-4 text-xs leading-relaxed text-muted-foreground"
            >
              {error ||
                "This project may have been removed or belongs to another account."}
            </p>
            {error && (
              <AppButton variant="outline" size="sm" onClick={onRetry}>
                Retry opening project
              </AppButton>
            )}
          </section>
        </div>
        <section
          className="h-[34dvh] shrink-0 rounded-xl border border-border bg-card"
          aria-label="Timeline unavailable"
        >
          <div className="border-b border-border p-3 text-xs font-medium">
            Timeline
          </div>
          <div className="flex h-8 border-b border-border">
            <span className="w-[148px] border-r border-border px-3 py-2 text-[10px] text-muted-foreground">
              TRACKS
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
