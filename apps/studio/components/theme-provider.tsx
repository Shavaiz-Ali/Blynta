"use client";

import * as React from "react";
import { AppThemeProvider as NextThemesProvider } from "@blynta/ui";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
