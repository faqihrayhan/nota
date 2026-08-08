"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";
import { ChevronDown, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqData = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
];

export function FAQ() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <section id="faq" className="relative border-t border-ink-line/40 bg-ink-2/10 py-32 scroll-mt-28">
      <div className="relative mx-auto max-w-4xl px-6">
        <div className="text-center">
          <Reveal delay={0.1}>
            <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-text-muted">
              <HelpCircle className="h-3.5 w-3.5" />
              {t("faq.eyebrow")}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <h2 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {t("faq.title")}
            </h2>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="mt-4 text-lg text-text-muted max-w-xl mx-auto">
              {t("faq.desc")}
            </p>
          </Reveal>
        </div>

        <div className="mt-16 space-y-4">
          {faqData.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <Reveal key={i} delay={0.3 + i * 0.1} y={20} width="100%">
                <div
                  className={cn(
                    "overflow-hidden rounded-2xl border transition-all duration-300 backdrop-blur-sm",
                    isOpen
                      ? "border-accent/40 bg-ink-2/80 shadow-xl shadow-accent/5"
                      : "border-ink-line/30 bg-ink/30 hover:border-ink-line/60 hover:bg-ink-2/40"
                  )}
                >
                  <button
                    onClick={() => toggle(i)}
                    className="flex w-full items-center justify-between gap-6 p-6 text-left"
                  >
                    <span className="font-display text-base font-semibold text-text sm:text-lg">
                      {t(item.q)}
                    </span>
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-line/40 transition-transform duration-300",
                      isOpen && "bg-accent border-accent text-white rotate-180"
                    )}>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <p className="px-6 pb-6 text-base leading-relaxed text-text-muted border-t border-ink-line/20 pt-4 mt-1">
                          {t(item.a)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
