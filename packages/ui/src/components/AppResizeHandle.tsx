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
  onValuePreview,
  reverse = false,
  end = false,
}: {
  label: string;
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
  /** Preview geometry during a drag; commit state only on release. */
  onValuePreview?: (value: number) => void;
  reverse?: boolean;
  end?: boolean;
}) {
  const gesture = useRef<{
    start: number;
    value: number;
    final: number;
  } | null>(null);
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
      className={`workspace-resizer rounded-none p-0 min-h-0 min-w-0 touch-none shadow-none hover:bg-primary/25 focus-visible:bg-primary/25 ${axis === "x" ? "h-auto w-1.5 self-stretch cursor-col-resize" : "h-2 w-full cursor-row-resize"} resize-${axis} ${end ? "resize-end" : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {
          start: axis === "x" ? event.clientX : event.clientY,
          value,
          final: value,
        };
      }}
      onPointerMove={(event) => {
        if (!gesture.current) return;
        const position = axis === "x" ? event.clientX : event.clientY;
        const next = Math.max(
          min,
          Math.min(
            max,
            gesture.current.value +
              (position - gesture.current.start) * (reverse ? -1 : 1),
          ),
        );
        gesture.current.final = next;
        event.currentTarget.setAttribute(
          "aria-valuenow",
          String(Math.round(next)),
        );
        (onValuePreview ?? onValueChange)(next);
      }}
      onPointerUp={() => {
        if (gesture.current && onValuePreview)
          onValueChange(gesture.current.final);
        gesture.current = null;
      }}
      onPointerCancel={(event) => {
        if (gesture.current && onValuePreview)
          onValuePreview(gesture.current.value);
        event.currentTarget.setAttribute(
          "aria-valuenow",
          String(Math.round(value)),
        );
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
      <span
        aria-hidden="true"
        className={
          axis === "y"
            ? "block h-0.5 w-8 rounded-full bg-muted-foreground/40"
            : "block h-8 w-0.5 rounded-full bg-muted-foreground/40"
        }
      />
    </AppButton>
  );
}
