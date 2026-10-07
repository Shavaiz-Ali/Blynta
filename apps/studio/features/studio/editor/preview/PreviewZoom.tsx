"use client";
import { Check, ChevronDown } from "lucide-react";
import { AppButton, AppDropdown } from "@blynta/ui";

export const previewZooms = [25, 50, 75, 100, 150, 200] as const;
export type PreviewZoomValue = "fit" | (typeof previewZooms)[number];

export function PreviewZoom({
  value,
  onChange,
}: {
  value: PreviewZoomValue;
  onChange: (value: PreviewZoomValue) => void;
}) {
  return (
    <AppDropdown
      align="end"
      trigger={
        <AppButton
          variant="ghost"
          size="sm"
          aria-label="Preview zoom"
          className="h-8 px-2 font-mono text-xs text-muted-foreground"
        >
          {value === "fit" ? "Fit" : `${value}%`}
          <ChevronDown className="size-3" />
        </AppButton>
      }
      items={(["fit", ...previewZooms] as const).map((zoom) => ({
        label: zoom === "fit" ? "Fit to workspace" : `${zoom}%`,
        icon: value === zoom ? <Check className="size-4" /> : undefined,
        onClick: () => onChange(zoom),
      }))}
    />
  );
}
