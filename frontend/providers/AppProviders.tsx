"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "./QueryProvider";
import { Toaster } from "@/components/ui/sonner";

export interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <QueryProvider>
        {children}
        <Toaster position="top-right" closeButton richColors />
      </QueryProvider>
    </SessionProvider>
  );
}
