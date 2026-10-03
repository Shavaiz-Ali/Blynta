"use client";
import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
const supportedMedia =
  ".mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg,.png,.jpg,.jpeg,.webp";
/** File chooser boundary; visible browse buttons supply keyboard access. */
export const AppFileInput = forwardRef<
  HTMLInputElement,
  {
    label: string;
    disabled?: boolean;
    onFile: (file?: File) => void;
    accept?: string;
  }
>(function AppFileInput(
  { label, disabled, onFile, accept = supportedMedia },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="file"
      hidden
      tabIndex={-1}
      aria-label={label}
      accept={accept}
      disabled={disabled}
      onChange={(event) => {
        onFile(event.target.files?.[0]);
        event.target.value = "";
      }}
    />
  );
});
