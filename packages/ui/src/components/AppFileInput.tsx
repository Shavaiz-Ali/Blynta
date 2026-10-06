"use client";
import { forwardRef } from "react";
import { Input } from "../primitives/input";
/** File chooser boundary; visible browse buttons supply keyboard access. */
export const AppFileInput = forwardRef<
  HTMLInputElement,
  {
    label: string;
    disabled?: boolean;
    onFile: (file?: File) => void;
    accept?: string;
  }
>(function AppFileInput({ label, disabled, onFile, accept }, ref) {
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
