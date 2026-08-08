"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles, Receipt } from "lucide-react";
import Link from "next/link";
  

const QR_PATTERN = [
  1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0,
  1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1,
  1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1,
];

export function Hero() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-stamp-green/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 md:grid-cols-2 md:items-center md:pt-28">
        <div className={cn("transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")}>
          <div className={cn("inline-flex items-center gap-2.5 rounded-full border border-ink-line/60 bg-ink-2/80 px-4 py-1.5 text-xs text-text-muted backdrop-blur-sm transition-all duration-700 delay-100", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-stamp-green" />
            </span>
            {t("hero.badge")}
          </div>

          <h1 className={cn("mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem] transition-all duration-1000 delay-200", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
            {t("hero.title1")}<br />
            <span className="text-accent relative">
              {t("hero.title2")}
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 8C50 2 100 2 150 6C200 10 250 10 298 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent/30" />
              </svg>
            </span>
          </h1>

          <p className={cn("mt-6 max-w-md text-base leading-relaxed text-text-muted transition-all duration-1000 delay-300", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
            {t("hero.desc")}
          </p>

          <div className={cn("mt-8 flex flex-wrap items-center gap-3 transition-all duration-1000 delay-400", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}>
            <Link href="/payment" className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20">
              <Receipt className="h-4 w-4" />
              {t("hero.ctaPrimary")}
            </Link>
            <Link href="/#how-it-works" className="group inline-flex items-center gap-2 rounded-full border border-ink-line/60 bg-ink-2/50 px-5 py-2.5 text-sm text-text transition-all duration-300 hover:border-text-muted hover:bg-ink-2">
              <Receipt className="h-4 w-4 text-text-muted transition-colors group-hover:text-text" />
              {t("hero.ctaSecondary")}
              <ArrowRight className="h-3.5 w-3.5 text-text-muted transition-all duration-300 group-hover:text-text group-hover:translate-x-0.5" />
            </Link>
          </div>

          <p className={cn("mt-5 font-mono text-xs text-text-faint transition-all duration-1000 delay-500", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
            <Sparkles className="inline h-3 w-3 mr-1.5 text-text-faint" />
            {t("hero.chainNote")}
          </p>
        </div>

        <div className={cn("relative mx-auto w-full max-w-sm transition-all duration-1000 delay-300", isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12")}>
          <div className="absolute -inset-8 -z-10">
            <div className="absolute inset-0 rounded-3xl bg-accent/8 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-paper-yellow/10 blur-[80px]" />
          </div>

          <div className="group/receipt relative">
            <div className="absolute -inset-2 rotate-[4deg] rounded-lg bg-paper-yellow/60 p-2 shadow-xl shadow-black/20 transition-transform duration-500 group-hover/receipt:rotate-[6deg] group-hover/receipt:scale-[1.02]" />
            <div className="absolute -inset-1 rotate-[-3deg] rounded-lg bg-paper-pink/70 p-2 shadow-xl shadow-black/25 transition-transform duration-500 delay-75 group-hover/receipt:rotate-[-5deg] group-hover/receipt:scale-[1.01]" />
            <div className="relative rotate-[1deg] rounded-lg bg-paper-white p-6 text-paper-ink shadow-2xl shadow-black/30 transition-transform duration-500 delay-150 group-hover/receipt:rotate-[2deg]">
              <div className="flex items-center justify-between border-b-2 border-dashed border-paper-ink/20 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-paper-ink text-paper-white font-display text-[10px] font-bold">N</div>
                    <p className="font-display text-sm font-semibold tracking-wide">NOTA</p>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-paper-ink/50">#ARC-04521</p>
                </div>
                <div className="grid grid-cols-8 gap-[2px]">
                  {QR_PATTERN.map((filled, i) => (
                    <span key={i} className={cn("h-1.5 w-1.5 rounded-[1px]", filled ? "bg-paper-ink" : "bg-transparent")} />
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-paper-ink/50">{t("hero.receipt.item1")}</span>
                  <span className="font-medium">32.000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-paper-ink/50">{t("hero.receipt.item2")}</span>
                  <span className="font-medium">3.000</span>
                </div>
                <div className="my-3 border-t border-dashed border-paper-ink/20" />
                <div className="flex justify-between items-center font-semibold">
                  <span>{t("hero.receipt.total")}</span>
                  <span>35.000 USDC</span>
                </div>
              </div>

              <div className="relative mt-6 flex items-center justify-between">
                <span className="font-mono text-[10px] text-paper-ink/40">{t("hero.receipt.block")}</span>
                <div className="relative">
                  <div className="absolute -inset-1 rounded-sm bg-stamp-green/10 blur-sm" />
                  <span className="relative rotate-[-6deg] inline-block rounded-sm border-2 border-stamp-green/80 px-2.5 py-1 font-display text-[11px] font-bold tracking-wider text-stamp-green">{t("hero.receipt.stamp")}</span>
                </div>
              </div>

              <div className="absolute -bottom-3 left-0 right-0 flex justify-between px-2">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-ink" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}