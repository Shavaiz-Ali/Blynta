import type { Metadata, Viewport } from "next";
import { AppThemeProvider } from "@blynta/ui";
import { siteConfig } from "../lib/site";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: "%s | Blynta",
  },
  description: siteConfig.description,
  keywords: [
    "AI video generator",
    "video to shorts",
    "repurpose podcast",
    "TikTok clips generator",
    "YouTube shorts AI",
    "Instagram Reels editor",
    "dynamic auto captions",
    "smart video reframing",
    "video highlight detection",
    "Blynta",
  ],
  authors: [{ name: "Blynta Team", url: siteConfig.url }],
  creator: "Blynta",
  publisher: "Blynta",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    creator: "@blynta",
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="antialiased"
    >
      <body className="bg-background text-foreground min-h-screen">
        <AppThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg focus:outline-none"
            href="#main"
          >
            Skip to content
          </a>
          {children}
        </AppThemeProvider>
      </body>
    </html>
  );
}
