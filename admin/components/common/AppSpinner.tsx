/**
 * AppSpinner — global loading indicator built on top of the shadcn Spinner
 * (components/ui/spinner.tsx), which uses Lucide's Loader2Icon.
 *
 * Supports three sizes and an optional accessible label.
 * Use this everywhere a loading state needs to be shown — buttons, overlays, etc.
 */

import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type AppSpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<AppSpinnerSize, string> = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export interface AppSpinnerProps extends React.ComponentProps<"svg"> {
  /** Controls the icon size. Defaults to "sm" (16 px — fits inside buttons). */
  size?: AppSpinnerSize;
  /** Accessible label announced to screen readers. Defaults to "Loading…" */
  label?: string;
}

const AppSpinner = React.forwardRef<SVGSVGElement, AppSpinnerProps>(
  ({ size = "sm", label = "Loading…", className, ...props }, ref) => {
    return (
      <Spinner
        ref={ref}
        aria-label={label}
        className={cn(sizeClasses[size], className)}
        {...props}
      />
    );
  }
);
AppSpinner.displayName = "AppSpinner";

export { AppSpinner };
