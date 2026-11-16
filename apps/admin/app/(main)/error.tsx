"use client";

import { useEffect } from "react";
import { AppButton } from "@blynta/ui";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console or telemetry
    console.error("Admin dashboard runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm mb-4">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this section."}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <AppButton
          onClick={() => reset()}
          className="inline-flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </AppButton>
        <AppButton
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload page
        </AppButton>
      </div>
    </div>
  );
}

