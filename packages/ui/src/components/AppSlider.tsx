"use client";
import { cn } from "../lib/utils";
import { Slider } from "../primitives/slider";
export function AppSlider({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
  showTrack = true,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  showTrack?: boolean;
}) {
  return (
    <Slider
      aria-label={label}
      value={[value]}
      onValueChange={(values) =>
        onValueChange(Array.isArray(values) ? values[0] : values)
      }
      min={min}
      max={Math.max(max, min + step)}
      step={step}
      disabled={disabled}
      className={cn(
        !showTrack &&
          "[&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent",
        className,
      )}
    />
  );
}
