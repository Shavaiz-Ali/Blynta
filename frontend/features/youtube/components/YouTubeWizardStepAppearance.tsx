"use client";

import * as React from "react";
import { AppSpinner } from "@/components/common/AppSpinner";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface YouTubeWizardStepAppearanceProps {
  thumbnailPreviewUrl?: string;
  isUploading: boolean;
  onUploadFile: (file: File) => void;
  onRemove: () => void;
  error?: string;
}

export function YouTubeWizardStepAppearance({
  thumbnailPreviewUrl,
  isUploading,
  onUploadFile,
  onRemove,
  error,
}: YouTubeWizardStepAppearanceProps) {
  const thumbnailInputRef = React.useRef<HTMLInputElement>(null);

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxBytes) {
      toast.error("Thumbnail must be 2 MB or smaller");
      return;
    }

    onUploadFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3 pr-1">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Choose an optional custom thumbnail for your Short.{" "}
        <span className="text-foreground/70">JPEG, PNG, or WebP · max 2 MB</span>
      </p>

      {thumbnailPreviewUrl ? (
        /* Thumbnail preview */
        <div className="relative group rounded-lg overflow-hidden border border-border bg-muted/40 aspect-video max-w-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailPreviewUrl}
            alt="Thumbnail preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => thumbnailInputRef.current?.click()}
              className="text-[11px] bg-white/90 text-foreground rounded-md px-2.5 py-1.5 font-medium hover:bg-white transition-colors cursor-pointer"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] bg-destructive/90 text-white rounded-md px-2.5 py-1.5 font-medium hover:bg-destructive transition-colors cursor-pointer"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* Upload button */
        <button
          type="button"
          onClick={() => thumbnailInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-border rounded-lg py-8 px-4 text-center transition-colors",
            "hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <>
              <AppSpinner size="sm" className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uploading...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-7 w-7 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-foreground">Upload thumbnail</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click to choose an image
                </p>
              </div>
            </>
          )}
        </button>
      )}

      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleThumbnailFileChange}
        aria-label="Upload thumbnail"
      />

      {error && (
        <p className="text-xs text-destructive font-medium" role="alert">
          {error}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground/70">
        Thumbnail is optional. If not set, YouTube will auto-select a frame from your video.
      </p>
    </div>
  );
}
