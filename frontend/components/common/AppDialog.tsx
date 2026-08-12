"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  titleClassName?: string;
  contentClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  descriptionClassName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showCloseButton = true,
  titleClassName,
  contentClassName,
  bodyClassName,
  footerClassName,
  descriptionClassName,
  size = "md",
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0 rounded-xl",
          sizeMap[size],
          contentClassName
        )}
        showCloseButton={false}
      >
        {(title || description) && (
          <DialogHeader className="relative px-6 pt-6 pb-0">
            {title && (
              <DialogTitle
                className={cn(
                  "text-xl font-semibold leading-none tracking-tight",
                  titleClassName
                )}
              >
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription
                className={cn(
                  "mt-2 text-sm text-muted-foreground",
                  descriptionClassName
                )}
              >
                {description}
              </DialogDescription>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 rounded-full opacity-70 transition-opacity hover:opacity-100 h-8 w-8"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogHeader>
        )}
        <div className={cn("px-6 py-6", bodyClassName)}>{children}</div>
        {footer && (
          <div
            className={cn(
              "flex flex-col-reverse sm:flex-row gap-2 px-6 pb-6 pt-0 sm:justify-end",
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { AppDialog };
