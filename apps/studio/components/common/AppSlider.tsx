"use client";
import { Slider } from "@/components/ui/slider";
export function AppSlider({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
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
      className={className}
    />
  );
}
