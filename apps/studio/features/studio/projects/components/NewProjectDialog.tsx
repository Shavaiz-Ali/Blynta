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
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const project = await studioApi.create(
        name || file.name.replace(/\.[^.]+$/, ""),
        ratio,
      );
      const asset = await uploadMedia(project.id, file);
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
    >
      <div className="grid gap-4">
        <div className="new-project-choices">
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
              key={choice.id}
              variant={mode === choice.id ? "secondary" : "outline"}
              className="project-choice"
              aria-pressed={mode === choice.id}
              disabled={busy}
              onClick={() => setMode(choice.id as "blank" | "upload")}
            >
              <choice.icon />
              <strong>{choice.title}</strong>
              <span>{choice.description}</span>
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
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) upload(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={25} />
            <strong>Drop your media here</strong>
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
