"use client";
import type { ComponentProps, ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type AppButtonProps = ComponentProps<typeof Button> & {
  isLoading?: boolean;
};

export function AppButton({ isLoading, children, disabled, ...props }: AppButtonProps) {
  return (
    <Button disabled={disabled || isLoading} aria-busy={isLoading} {...props}>
      {isLoading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function AppLinkButton({ render, ...props }: Omit<AppButtonProps, "nativeButton"> & { render: ReactElement }) {
  return <AppButton {...props} nativeButton={false} render={render} />;
}
