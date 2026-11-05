import React from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { siteConfig } from "../lib/site";

export function Footer() {
  const loginUrl = `${siteConfig.appUrl}/login`;
  const signupUrl = `${siteConfig.appUrl}/signup`;

  return (
    <footer className="border-t border-border bg-muted/40 text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <Logo size="md" />
            <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
              AI-powered video clip engine for creators, podcasters, and media
              teams. Turn long-form recordings into scroll-stopping shorts with
              active face-tracking and dynamic captions.
            </p>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">
              Product
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#howitworks" className="hover:text-foreground transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <Link href={loginUrl} className="hover:text-foreground transition-colors">
                  AI Studio
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">
              Company
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#howitworks" className="hover:text-foreground transition-colors">
                  Methodology
                </a>
              </li>
              <li>
                <Link href={signupUrl} className="hover:text-foreground transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">
              Legal
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <span className="cursor-default hover:text-foreground transition-colors">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="cursor-default hover:text-foreground transition-colors">
                  Terms of Service
                </span>
              </li>
              <li>
                <span className="cursor-default hover:text-foreground transition-colors">
                  Cookie Preferences
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-bar */}
        <div className="mt-14 pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} Blynta. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
              aria-label="Blynta on X (Twitter)"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
              aria-label="Blynta on YouTube"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a
              href={siteConfig.links.linkedin}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
              aria-label="Blynta on LinkedIn"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.55a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

