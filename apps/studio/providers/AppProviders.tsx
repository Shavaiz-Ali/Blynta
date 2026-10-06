"use client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { QueryProvider } from "./QueryProvider";
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          {children}
          <Toaster richColors closeButton />
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
