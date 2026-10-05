"use client";
import { useRef } from "react";
import { AppButton } from "./AppButton";

/** Pointer and keyboard resizing share the same bounded value setter. */
export function AppResizeHandle({
  label,
  axis,
  value,
  min,
  max,
  onValueChange,
  reverse = false,
  end = false,
}: {
  label: string;
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
  reverse?: boolean;
  end?: boolean;
}) {
  const gesture = useRef<{ start: number; value: number } | null>(null);
  const update = (next: number) =>
    onValueChange(Math.max(min, Math.min(max, next)));
  return (
    <AppButton
      variant="ghost"
      role="separator"
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={`workspace-resizer rounded-none p-0 min-h-0 min-w-0 ${axis === "x" ? "h-full w-1.5" : "h-2 w-full"} resize-${axis} ${end ? "resize-end" : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {
          start: axis === "x" ? event.clientX : event.clientY,
          value,
        };
      }}
      onPointerMove={(event) => {
        if (!gesture.current) return;
        const position = axis === "x" ? event.clientX : event.clientY;
        update(
          gesture.current.value +
            (position - gesture.current.start) * (reverse ? -1 : 1),
        );
      }}
      onPointerUp={() => {
        gesture.current = null;
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onKeyDown={(event) => {
        const direction =
          axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (direction.includes(event.key)) {
          event.preventDefault();
          update(
            value +
              (event.key === direction[0] ? -16 : 16) * (reverse ? -1 : 1),
          );
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          update(event.key === "Home" ? min : max);
        }
      }}
    >
      <span aria-hidden="true" />
    </AppButton>
  );
}
