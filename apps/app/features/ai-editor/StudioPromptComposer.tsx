"use client";
import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Library, Send, X, RotateCcw } from "lucide-react";
import { AppButton, AppTextarea, AppPopover, AppFileInput } from "@blynta/ui";
import type { StudioAsset } from "./contracts";
import scrollbars from "./studio-scrollbars.module.css";
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = "auto";
      input.style.height = `${Math.min(112, Math.max(40, input.scrollHeight))}px`;
    }
  }, [prompt]);
  const [picker, setPicker] = useState(false),
    [library, setLibrary] = useState(false),
    [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  return (
    <form
      aria-label="Editing prompt composer"
      className={`relative order-3 mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] mt-2 shrink-0 space-y-1.5 rounded-lg border border-input bg-background p-2.5 shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 ${dragging ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}
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
          className={`${scrollbars.slim} flex max-h-24 flex-wrap gap-2 overflow-y-auto`}
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
        ref={inputRef}
        id="studio-prompt"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
        maxLength={4000}
        disabled={disabled}
        placeholder="Ask Blynta to edit your video…"
        className={`${scrollbars.slim} max-h-28 min-h-10 resize-none overflow-y-auto border-0 bg-transparent p-1 text-base leading-6 shadow-none focus-visible:ring-0 sm:text-sm`}
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
      <div className={`${scrollbars.slim} max-h-20 space-y-1 overflow-y-auto`}>
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
            <div
              className={`${scrollbars.slim} max-h-60 space-y-1 overflow-y-auto p-2`}
            >
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
        {prompt.length >= 3500 && (
          <span className="shrink-0 tabular-nums">{prompt.length}/4000</span>
        )}
      </p>
    </form>
  );
}
