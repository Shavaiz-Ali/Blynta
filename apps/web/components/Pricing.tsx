"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Zap, Sparkles } from "lucide-react";
import { siteConfig } from "../lib/site";

export function Pricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );

  return (
    <section
      id="pricing"
      className="py-20 sm:py-28 bg-muted/20 border-t border-border"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            TRANSPARENT PRICING
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            Predictable plans. Zero surprises.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Every plan includes our full neural hook engine. Switch or cancel
            anytime.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-border bg-card p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Annual Billing</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-7xl mx-auto">
          {siteConfig.pricing.map((plan) => {
            const price =
              billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
            const signupLink = `${siteConfig.appUrl}${plan.href}`;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all duration-300 ${
                  plan.popular
                    ? "border-2 border-primary bg-card shadow-2xl shadow-primary/15 hover:-translate-y-2"
                    : "border border-border bg-card shadow-sm hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                }`}
              >
                {/* Popular Pill */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-indigo-500 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-primary/30 flex items-center gap-1 whitespace-nowrap">
                    <Zap className="h-3.5 w-3.5 fill-white" />
                    <span>Most Popular Choice</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className={`text-base font-extrabold uppercase tracking-wider ${
                        plan.popular ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {plan.name}
                    </h3>

                    {plan.badge && !plan.popular && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 mb-4">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground font-mono">
                      ${price}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">
                      / month
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  {/* Feature Checklist */}
                  <ul className="space-y-3.5 mb-8 border-t border-border/60 pt-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                            plan.popular
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        </div>
                        <span
                          className={
                            plan.popular && idx < 2
                              ? "font-bold text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <Link
                  href={signupLink}
                  className={`inline-flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-semibold transition-all cursor-pointer ${
                    plan.popular
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
                      : "border border-border bg-muted/40 text-foreground hover:bg-muted/90 hover:border-border/80"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
