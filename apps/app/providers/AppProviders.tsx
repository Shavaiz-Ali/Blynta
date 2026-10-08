"use client";

import * as React from "react";
import { SessionProvider } from "@blynta/auth/react";
import { QueryProvider } from "./QueryProvider";
import { Toaster } from "@/components/ui/sonner";

export interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <QueryProvider>
        {children}
        <Toaster position="top-right" closeButton richColors />
      </QueryProvider>
    </SessionProvider>
  );
}
