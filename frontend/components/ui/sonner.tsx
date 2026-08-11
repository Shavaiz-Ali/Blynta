"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl font-sans text-sm p-4 border flex items-center gap-3",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium text-xs rounded-lg px-3 py-1.5",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs rounded-lg px-3 py-1.5",
          error:
            "group-[.toaster]:bg-destructive/10 group-[.toaster]:text-destructive group-[.toaster]:border-destructive/30",
          success:
            "group-[.toaster]:bg-emerald-500/10 group-[.toaster]:text-emerald-600 dark:group-[.toaster]:text-emerald-400 group-[.toaster]:border-emerald-500/30",
          info:
            "group-[.toaster]:bg-sky-500/10 group-[.toaster]:text-sky-600 dark:group-[.toaster]:text-sky-400 group-[.toaster]:border-sky-500/30",
          warning:
            "group-[.toaster]:bg-amber-500/10 group-[.toaster]:text-amber-600 dark:group-[.toaster]:text-amber-400 group-[.toaster]:border-amber-500/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
