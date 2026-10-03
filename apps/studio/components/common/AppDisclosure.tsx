"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AppButton } from "./AppButton";
export function AppDisclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className="inspector-disclosure">
      <AppButton
        variant="ghost"
        size="sm"
        className="disclosure-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown className={open ? "" : "-rotate-90"} />
      </AppButton>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
