"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { siteConfig } from "../lib/site";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 sm:py-28 bg-muted/20 border-t border-border">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
            FREQUENTLY ASKED QUESTIONS
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
            Everything you need to know.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Have a question? We&apos;re here to help you get the most out of Blynta.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4 text-left">
          {siteConfig.faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={index}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs transition-colors hover:border-border/80"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between p-5 sm:p-6 text-left cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-bold text-foreground pr-4">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 text-muted-foreground"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="border-t border-border/50 px-5 sm:px-6 pt-3 pb-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

