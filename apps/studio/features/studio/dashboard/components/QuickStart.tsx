import { ArrowUpRight, Clapperboard, FilePlus2, Upload } from "lucide-react";
import { AppButton, AppDialog, AppLinkButton } from "@blynta/ui";
import { blyntaUrl } from "@/config/env";

export type CreationMode = "blank" | "upload";

export function QuickStart({
  onNew,
  onBlynta,
}: {
  onNew: (mode: CreationMode) => void;
  onBlynta: () => void;
}) {
  return (
    <section aria-labelledby="quick-start-heading">
      <h2 id="quick-start-heading" className="workspace-eyebrow">
        Quick start
      </h2>
      <div className="studio-quick-start">
        {[
          {
            title: "New project",
            description: "Start with an empty timeline",
            icon: FilePlus2,
            action: () => onNew("blank"),
          },
          {
            title: "Upload video",
            description: "Bring footage from your device",
            icon: Upload,
            action: () => onNew("upload"),
          },
          {
            title: "From Blynta",
            description: "Turn your Blynta clips into a new edit",
            icon: Clapperboard,
            action: onBlynta,
          },
        ].map(({ title, description, icon: Icon, action }) => (
          <AppButton
            key={title}
            variant="outline"
            className="studio-quick-action h-auto min-h-28 rounded-xl border-border/80 bg-card shadow-xs text-left hover:border-primary/35 hover:shadow-md [&>span]:w-full"
            onClick={action}
          >
            <span className="quick-action-icon">
              <Icon size={21} />
            </span>
            <span className="quick-action-copy">
              <strong>{title}</strong>
              <span>{description}</span>
            </span>
            <ArrowUpRight size={16} className="quick-action-arrow" />
          </AppButton>
        ))}
      </div>
    </section>
  );
}

export function FromBlyntaDialog({
  open,
  onOpenChange,
  importedCount,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importedCount: number;
  onImported: () => void;
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bring your clips into Studio"
      description="Continue creating with the media you already have in Blynta."
    >
      <div className="grid gap-4">
        <div className="blynta-import-guide">
          <span className="quick-action-icon">
            <Clapperboard size={24} />
          </span>
          <p>
            Open a generated clip in Blynta, then choose{" "}
            <strong>Edit in Studio</strong>. Your clip and its source media are
            linked to a Studio project without another upload.
          </p>
        </div>
        <AppLinkButton
          role="link"
          render={<a href={`${blyntaUrl.replace(/\/$/, "")}/my-clips`} />}
          icon={<ArrowUpRight />}
        >
          Browse Blynta clips
        </AppLinkButton>
        {importedCount > 0 && (
          <AppButton variant="outline" onClick={onImported}>
            View {importedCount} Blynta{" "}
            {importedCount === 1 ? "project" : "projects"} in Studio
          </AppButton>
        )}
      </div>
    </AppDialog>
  );
}
