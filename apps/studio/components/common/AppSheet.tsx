"use client";
import type { ReactNode, CSSProperties } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
export function AppSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  modal = true,
  className,
  style,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  modal?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal={modal}
      disablePointerDismissal={!modal}
    >
      <SheetContent
        overlay={modal}
        style={style}
        className={cn("w-[420px]! max-w-[100vw]! gap-0", className)}
      >
        <SheetHeader className="border-b p-5 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="mt-1 text-xs">
            {description}
          </SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
