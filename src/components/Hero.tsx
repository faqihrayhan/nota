"use client";

import { motion } from "framer-motion";
import { Reveal, TextReveal } from "@/components/Reveal";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function Hero() {
  const { t } = useLanguage();

  return (
    <section id="top" className="relative min-h-[90vh] overflow-hidden flex items-center pt-16 pb-20">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-accent/10 blur-[100px]" />
        <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 w-full">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          
          {/* Left Column: Text & CTA */}
          <div className="flex flex-col items-start text-left">
            <Reveal delay={0.1}>
              <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/60 bg-ink-2/80 px-4 py-1.5 text-xs font-mono uppercase tracking-[0.2em] text-accent backdrop-blur-md shadow-lg shadow-accent/5">
                <Sparkles className="h-3.5 w-3.5" />
                {t("hero.badge")}
              </div>
            </Reveal>

            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <TextReveal text={t("hero.title1")} delay={0.2} />
              <span className="relative mt-2 block text-accent italic">
                <TextReveal text={t("hero.title2")} delay={0.4} />
              </span>
            </h1>

            <Reveal delay={0.5}>
              <p className="mt-6 text-lg sm:text-xl text-text-muted max-w-xl leading-relaxed">
                {t("hero.desc")}
              </p>
            </Reveal>

            <Reveal delay={0.6}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/payment"
                  className="group inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 font-display font-semibold text-white shadow-xl shadow-accent/25 hover:bg-accent/90 transition-all duration-300 hover:scale-[1.02]"
                >
                  {t("hero.ctaPrimary")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-ink-line/60 bg-ink-2/50 px-8 py-4 font-display font-semibold text-text hover:bg-ink-2 hover:border-ink-line transition-all duration-300 backdrop-blur-sm"
                >
                  {t("hero.ctaSecondary")}
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.7}>
              <div className="mt-12 flex items-center gap-6 text-xs font-mono text-text-muted">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>{t("hero.verified")}</span>
                </div>
                <div className="h-1 w-1 rounded-full bg-ink-line" />
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>{t("hero.instantSettlement")}</span>
                </div>
                <div className="h-1 w-1 rounded-full bg-ink-line" />
                <span>{t("hero.chainNote")}</span>
              </div>
            </Reveal>
          </div>

          {/* Right Column: PNG Receipt Image Hero */}
          <div className="relative flex justify-center items-center mt-8 lg:mt-0">
            <div className="absolute -inset-4 bg-accent/10 rounded-full blur-3xl -z-10" />
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-[480px] drop-shadow-2xl"
            >
              <Image
                src="/images/receipt-hero.svg"
                alt={t("hero.receiptAlt")}
                width={680}
                height={880}
                priority
                className="w-full h-auto object-contain block"
              />
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
