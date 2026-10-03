"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

function AuthCard({ children, className, header, footer }: AuthCardProps) {
  return (
    <div className={cn("w-full max-w-md mx-auto space-y-5", className)}>
      <div className="rounded-2xl border border-border/80 bg-card/90 text-card-foreground shadow-xl backdrop-blur-xl p-6 sm:p-8 space-y-5 transition-all">
        {header && <div className="text-left space-y-1">{header}</div>}
        {children}
      </div>
      {footer && <div className="text-center pt-1">{footer}</div>}
    </div>
  );
}

export { AuthCard };
