"use client";

import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/context/LanguageContext";
import { Wallet, QrCode, FileCheck } from "lucide-react";

export function WorkflowSection() {
  const { t } = useLanguage();
  
  const steps = [
    {
      num: "01",
      icon: Wallet,
      title: t("workflow.step1Title"),
      desc: t("workflow.step1Desc"),
    },
    {
      num: "02",
      icon: QrCode,
      title: t("workflow.step2Title"),
      desc: t("workflow.step2Desc"),
    },
    {
      num: "03",
      icon: FileCheck,
      title: t("workflow.step3Title"),
      desc: t("workflow.step3Desc"),
    },
  ];

  return (
    <section className="relative py-28 border-b border-ink-line/40 bg-ink">
      <div className="mx-auto max-w-7xl px-6">
        {/* Centered Header Container */}
        <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
          <Reveal delay={0.1} width="100%">
            <div className="flex justify-center w-full">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-accent font-medium">
                {t("workflow.eyebrow")}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.2} width="100%">
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl text-center">
              {t("workflow.title")}
            </h2>
          </Reveal>

          <Reveal delay={0.3} width="100%">
            <p className="mt-3 text-text-muted text-center max-w-lg mx-auto">
              {t("workflow.desc")}
            </p>
          </Reveal>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={i} delay={0.2 + i * 0.15} y={20} width="100%">
              <div className="relative flex flex-col justify-between h-full rounded-2xl border border-ink-line/40 bg-ink-2/40 p-8 hover:border-accent/40 transition-all backdrop-blur-sm min-h-[15rem]">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent shrink-0">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <span className="font-mono text-3xl font-bold text-ink-line/60">{s.num}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold leading-snug">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
