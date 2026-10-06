"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AppButton } from "./AppButton";
import { cn } from "../lib/utils";
export function AppDisclosure({
  title,
  children,
  defaultOpen = true,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={cn("mt-3", className)}>
      <AppButton
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        icon={<ChevronDown className={open ? "" : "-rotate-90"} />}
        iconPosition="right"
      >
        {title}
      </AppButton>
      <div id={id} hidden={!open} className="pt-3">
        {children}
      </div>
    </section>
  );
}
