"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppDialog } from "@blynta/ui";
import { AppFileInput } from "@/components/common/AppFileInput";
import { AppInput } from "@blynta/ui";
import { AppSelect } from "@blynta/ui";
import { AppButton } from "@blynta/ui";
import { Upload, FilePlus2, ArrowRight } from "lucide-react";
import { studioApi } from "../../api";
import { uploadMedia } from "../media";
import { makeClip } from "../document";
import type { AspectRatio, Project } from "../../types";
export function NewProjectDialog({
  open,
  onOpenChange,
  onCreate,
  initialMode = "upload",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (p: Project) => void | Promise<void>;
  initialMode?: "blank" | "upload";
}) {
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [phase, setPhase] = useState<"uploading" | "processing">("uploading");
  const [mode, setMode] = useState(initialMode);
  async function launch(project: Project) {
    try {
      await onCreate(project);
      onOpenChange(false);
      router.push(`/editor/${project.id}`);
    } catch {
      setError(
        "Couldn’t save the project. Check your connection and try again.",
      );
    }
  }
  async function upload(file?: File) {
    if (!file || pending.current) return;
    pending.current = true;
    setBusy(true);
    setPhase("uploading");
    setError("");
    try {
      const project = await studioApi.create(
        name || file.name.replace(/\.[^.]+$/, ""),
        ratio,
      );
      const asset = await uploadMedia(project.id, file, setPhase);
      project.assets = [asset];
      project.clips = [makeClip(asset)];
      const saved = await studioApi.save(project.id, project.revision || 0, {
        name: project.name,
        ratio: project.ratio,
        assets: project.assets,
        clips: project.clips,
        tracks: project.tracks,
      });
      project.revision = saved.revision;
      await launch(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open this file.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
      title="New project"
      description="Upload media or start with an empty timeline."
      size="lg"
      contentClassName="max-h-[90dvh] overflow-y-auto"
      dismissible={!busy}
      showCloseButton={!busy}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              id: "upload",
              title: "Upload video",
              description: "Use footage from your device",
              icon: Upload,
            },
            {
              id: "blank",
              title: "Blank project",
              description: "Build an edit from scratch",
              icon: FilePlus2,
            },
          ].map((choice) => (
            <AppButton
              type="button"
              key={choice.id}
              variant="outline"
              className={`h-auto min-w-0 justify-start whitespace-normal rounded-xl p-4 text-left [&>span]:w-full [&>span>span]:min-w-0 [&>span>span]:w-full [&>span>span]:whitespace-normal ${mode === choice.id ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:bg-muted/50"}`}
              aria-pressed={mode === choice.id}
              disabled={busy}
              onClick={() => setMode(choice.id as "blank" | "upload")}
            >
              <span className="flex min-w-0 flex-col items-start gap-2">
                <choice.icon className="h-5 w-5" />
                <strong className="text-sm leading-5">{choice.title}</strong>
                <span className="text-xs leading-5 text-muted-foreground">
                  {choice.description}
                </span>
              </span>
            </AppButton>
          ))}
        </div>
        <AppInput
          label="Project name"
          disabled={busy}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled project"
        />
        <AppSelect
          label="Aspect ratio"
          disabled={busy}
          value={ratio}
          onValueChange={(v) => setRatio(v as AspectRatio)}
          options={[
            { value: "16:9", label: "16:9 · Landscape" },
            { value: "9:16", label: "9:16 · Portrait" },
            { value: "1:1", label: "1:1 · Square" },
            { value: "4:5", label: "4:5 · Social" },
          ]}
        />
        {mode === "upload" && (
          <div
            className="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-7 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) upload(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={25} />
            <strong className="text-sm" role={busy ? "status" : undefined}>
              {busy
                ? phase === "uploading"
                  ? "Uploading your media…"
                  : "Preparing your media…"
                : "Drop your media here"}
            </strong>
            <span className="text-xs text-muted-foreground">
              MP4, WebM, MOV, audio, or images
            </span>
            <AppButton
              variant="outline"
              isLoading={busy}
              onClick={() => fileRef.current?.click()}
            >
              Browse files
            </AppButton>
            <AppFileInput
              ref={fileRef}
              label="Upload project media"
              disabled={busy}
              onFile={upload}
            />
          </div>
        )}
        {mode === "blank" && (
          <div className="grid gap-3">
            <AppButton
              disabled={busy}
              variant="outline"
              onClick={async () => {
                if (pending.current) return;
                pending.current = true;
                setBusy(true);
                setError("");
                try {
                  await launch(
                    await studioApi.create(name || "Untitled project", ratio),
                  );
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Unable to create project",
                  );
                } finally {
                  pending.current = false;
                  setBusy(false);
                }
              }}
            >
              <FilePlus2 />
              Start blank
              <ArrowRight />
            </AppButton>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Projects and media are saved securely to your Blynta account.
        </p>
      </div>
    </AppDialog>
  );
}
