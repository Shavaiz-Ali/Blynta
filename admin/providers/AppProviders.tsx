"use client";
import { useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
export type AppProvidersProps = { children: ReactNode };
export function AppProviders({ children }: AppProvidersProps) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => count < 1 && !("status" in error && [401, 403].includes(Number(error.status))) } } }));
  return <SessionProvider><QueryClientProvider client={client}><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><TooltipProvider>{children}<Toaster /></TooltipProvider></ThemeProvider></QueryClientProvider></SessionProvider>;
}
