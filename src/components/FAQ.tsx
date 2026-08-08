"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Reveal } from "@/components/Reveal";
import { HelpCircle } from "lucide-react";

const faqData = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
];

export function FAQ() {
  const { t } = useLanguage();

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
          {faqData.map((item, i) => (
            <Reveal key={i} delay={0.3 + i * 0.1} y={20}>
              <div className="rounded-2xl border border-ink-line/30 bg-ink/30 p-6 backdrop-blur-sm transition-all duration-300 hover:border-ink-line/60">
                <h3 className="font-display text-lg font-semibold text-text sm:text-xl">
                  {t(item.q)}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-text-muted border-t border-ink-line/20 pt-3">
                  {t(item.a)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
