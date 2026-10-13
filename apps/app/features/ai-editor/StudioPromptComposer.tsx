"use client";
import { useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  Library,
  Lightbulb,
  Send,
  X,
  RotateCcw,
} from "lucide-react";
import { AppButton, AppTextarea, AppPopover, AppFileInput } from "@blynta/ui";
import type { StudioAsset } from "./contracts";
import type { useStudioAttachments } from "./attachments";
type Attachments = ReturnType<typeof useStudioAttachments>;
export function StudioPromptComposer({
  prompt,
  onChange,
  onSubmit,
  disabled,
  sendDisabled,
  busy,
  attachments,
  assets,
  error,
  retry,
  modelControl,
}: {
  prompt: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  sendDisabled: boolean;
  busy: boolean;
  attachments: Attachments;
  assets: StudioAsset[];
  error?: React.ReactNode;
  retry?: React.ReactNode;
  modelControl?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [picker, setPicker] = useState(false),
    [library, setLibrary] = useState(false),
    [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  return (
    <form
      aria-label="Editing prompt composer"
      className={`relative order-2 m-3 shrink-0 space-y-2 rounded-xl bg-muted/50 p-3 ring-1 ring-border/60 focus-within:ring-primary/50 sm:m-4 lg:order-3 lg:mt-0 ${dragging ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}
      onDragEnter={(e) => {
        if (!disabled && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = disabled ? "none" : "copy";
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!disabled) attachments.addFiles(Array.from(e.dataTransfer.files));
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!sendDisabled && !attachments.blocked) onSubmit();
      }}
    >
      {dragging && (
        <p role="status" className="text-sm font-medium text-primary">
          Drop a PNG image or audio file to use in your edit.
        </p>
      )}
      {!!attachments.items.length && (
        <ul
          aria-label="Prompt attachments"
          className="flex max-h-24 flex-wrap gap-2 overflow-y-auto"
        >
          {attachments.items.map((a) => (
            <li
              key={a.key}
              className="flex max-w-full items-center gap-1 rounded-md border bg-muted/40 py-1 pl-2 text-xs"
            >
              <span className="max-w-36 truncate" title={a.name}>
                {a.name}
              </span>
              <span aria-live="polite" className="text-muted-foreground">
                {a.status === "processing" ? "Validating" : a.status}
              </span>
              {a.status === "failed" && (
                <AppButton
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Retry ${a.name}`}
                  onClick={() => attachments.retry(a.key)}
                >
                  <RotateCcw className="size-3" />
                </AppButton>
              )}
              <AppButton
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${a.name} from prompt`}
                disabled={disabled}
                onClick={() => attachments.remove(a.key)}
              >
                <X className="size-3" />
              </AppButton>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="studio-prompt" className="sr-only">
        Describe your editing instructions
      </label>
      <AppTextarea
        id="studio-prompt"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={4000}
        disabled={disabled}
        placeholder="Try: Add a smooth zoom from 00:00 to 00:03, then lower the original audio to 70%."
        className="max-h-32 min-h-20 resize-y border-0 bg-transparent p-1 text-sm leading-6 shadow-none focus-visible:ring-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!sendDisabled && !attachments.blocked) onSubmit();
          }
        }}
      />
      {(attachments.error || attachments.validationError) && (
        <div role="alert" className="text-xs text-destructive">
          {attachments.error || attachments.validationError}
          {attachments.validationError && (
            <AppButton
              type="button"
              variant="link"
              size="sm"
              onClick={attachments.recheck}
            >
              Check validation again
            </AppButton>
          )}
        </div>
      )}
      <div className="max-h-20 space-y-1 overflow-y-auto">
        {attachments.items
          .filter((a) => a.error)
          .map((a) => (
            <p
              key={a.key}
              role="alert"
              className="break-words text-xs text-destructive"
            >
              {a.name}: {a.error}
            </p>
          ))}
      </div>
      {error}
      {retry}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <AppPopover
            title={library ? "Choose ready media" : "Attach media"}
            open={picker}
            onOpenChange={(v) => {
              setPicker(v);
              if (!v) setLibrary(false);
            }}
            align="start"
            side="top"
            contentClassName="w-72 max-w-[calc(100vw-2rem)]"
            trigger={
              <AppButton
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
              >
                <Paperclip className="size-4" />
                <span className="sr-only">Attach</span>
              </AppButton>
            }
          >
            <div className="max-h-60 space-y-1 overflow-y-auto p-2">
              {library ? (
                assets.length ? (
                  assets.map((a) => (
                    <AppButton
                      key={a.assetId}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      disabled={disabled}
                      onClick={() => {
                        attachments.select(a);
                        setPicker(false);
                      }}
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.kind}
                      </span>
                    </AppButton>
                  ))
                ) : (
                  <p className="p-2 text-xs text-muted-foreground">
                    No ready media yet. Upload a PNG or audio file.
                  </p>
                )
              ) : (
                <>
                  <AppButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setPicker(false);
                      fileRef.current?.click();
                    }}
                  >
                    <Upload className="size-4" />
                    Upload from device
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setLibrary(true)}
                  >
                    <Library className="size-4" />
                    Choose from your assets
                  </AppButton>
                  <p className="px-2 pb-1 text-xs text-muted-foreground">
                    PNG, MP3, WAV, M4A, OGG · Up to 100 MiB
                  </p>
                </>
              )}
            </div>
          </AppPopover>
          <AppFileInput
            ref={fileRef}
            label="Upload editing media"
            accept=".png,.mp3,.wav,.m4a,.ogg"
            disabled={disabled}
            onFile={(file) => {
              if (file) attachments.addFiles([file]);
            }}
          />
          {modelControl}
          <AppPopover
            title="Try an edit"
            align="start"
            side="top"
            contentClassName="w-72 max-w-[calc(100vw-2rem)]"
            trigger={
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label="Prompt suggestions"
              >
                <Lightbulb className="size-4" />
              </AppButton>
            }
          >
            <div className="space-y-1 p-2">
              {[
                "Add a smooth zoom from 00:00 to 00:03.",
                "Lower the original audio to 70%.",
                ...(attachments.items.some(
                  (a) =>
                    a.name.toLowerCase().endsWith(".png") &&
                    a.status === "ready",
                )
                  ? ["Add my attached image from 00:01 to 00:03."]
                  : []),
              ].map((s) => (
                <AppButton
                  key={s}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start text-left text-xs"
                  contentClassName="whitespace-normal"
                  onClick={() => onChange(s)}
                >
                  {s}
                </AppButton>
              ))}
            </div>
          </AppPopover>
        </div>
        <div className="flex items-center gap-2">
          <AppButton
            type="submit"
            size="sm"
            disabled={sendDisabled || attachments.blocked}
          >
            <Send className="size-3.5" />
            {busy ? "Working…" : "Send"}
          </AppButton>
        </div>
      </div>
      <p className="flex items-start justify-between gap-2 text-xs leading-5 text-muted-foreground">
        <span>
          {attachments.blocked
            ? "Wait for validation, retry failed files, or remove them before sending."
            : "Enter to send · Shift+Enter for a new line"}
        </span>
        <span className="shrink-0 tabular-nums">{prompt.length}/4000</span>
      </p>
    </form>
  );
}
