// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import type { Metadata } from "next";
import { AppProviders } from "@/providers/AppProviders";
import "./globals.css";
import "./studio.css";
import "./dashboard.css";
import "./editor-layout.css";

export const metadata: Metadata = {
  title: "Blynta Studio",
  description:
    "Your next great story starts here. The Blynta video editing workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
