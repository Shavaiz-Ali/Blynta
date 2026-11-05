"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@blynta/ui";
import { Menu, X, ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "./Logo";
import { siteConfig } from "../lib/site";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHover, setActiveHover] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loginUrl = `${siteConfig.appUrl}/login`;
  const signupUrl = `${siteConfig.appUrl}/signup`;

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/70 shadow-xs"
          : "bg-background/40 backdrop-blur-md border-b border-border/30"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Logo size="md" />
          <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            <span>v2.0 Neural Engine</span>
          </span>
        </div>

        {/* Desktop Navigation Links with Framer Motion pill */}
        <nav
          className="hidden md:flex items-center gap-1 text-sm font-medium"
          aria-label="Main Navigation"
          onMouseLeave={() => setActiveHover(null)}
        >
          {siteConfig.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onMouseEnter={() => setActiveHover(item.href)}
              className="relative px-3.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {activeHover === item.href && (
                <motion.div
                  layoutId="nav-hover-pill"
                  className="absolute inset-0 rounded-lg bg-muted/70 -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right Action Buttons & Theme Toggle */}
        <div className="hidden sm:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={loginUrl}
            className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href={signupUrl}
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200 hover:shadow-md hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Start Free</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer with AnimatePresence */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="sm:hidden border-b border-border bg-background/95 backdrop-blur-2xl px-5 pt-3 pb-6 shadow-xl overflow-hidden"
          >
            <nav className="flex flex-col space-y-1">
              {siteConfig.nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-muted-foreground hover:text-foreground py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex flex-col gap-2.5 pt-4 border-t border-border/60 mt-3">
              <Link
                href={loginUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-medium text-foreground bg-muted/60 hover:bg-muted rounded-xl border border-border"
              >
                Sign in
              </Link>
              <Link
                href={signupUrl}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-primary-foreground bg-primary rounded-xl shadow-md"
              >
                <span>Start Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
