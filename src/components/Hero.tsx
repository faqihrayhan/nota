"use client";

import { motion } from "framer-motion";
import { Reveal, TextReveal } from "@/components/Reveal";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles, Receipt, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

const QR_PATTERN = [
  1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0,
  1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1,
  1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1,
];

export function Hero() {
  const { t } = useLanguage();

  return (
    <section id="top" className="relative min-h-[85vh] overflow-hidden flex items-center pt-12 pb-16">
      {/* Background Animated Gradients — Motion Style */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -right-[10%] h-[600px] w-[600px] rounded-full bg-accent/10 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -60, 0],
            y: [0, 40, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-stamp-green/10 blur-[100px]" 
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-[1.2fr_1fr] md:items-center">
        {/* Left Content — The Sophisticated Text */}
        <div className="flex flex-col items-start text-left">
          <Reveal delay={0.1}>
            <div className="inline-flex items-center gap-2.5 rounded-full border border-ink-line/60 bg-ink-2/80 px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest text-text-muted backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-stamp-green" />
              </span>
              {t("hero.badge")}
            </div>
          </Reveal>

          <h1 className="mt-6 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <TextReveal text={t("hero.title1")} delay={0.2} />
            <span className="relative mt-1 block text-accent italic">
              <TextReveal text={t("hero.title2")} delay={0.4} />
              <motion.svg 
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
                className="absolute -bottom-2 left-0 w-[70%] max-w-[300px]" 
                viewBox="0 0 300 12" 
                fill="none"
              >
                <path d="M2 8C50 2 100 2 150 6C200 10 250 10 298 4" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-accent/40" />
              </motion.svg>
            </span>
          </h1>

          <Reveal delay={0.6} y={30}>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-text-muted md:text-xl">
              {t("hero.desc")}
            </p>
          </Reveal>

          <Reveal delay={0.8} y={20}>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link 
                href="/payment" 
                className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-accent/20 transition-all hover:bg-accent-strong hover:scale-105 active:scale-95"
              >
                <Zap className="h-4 w-4" />
                {t("hero.ctaPrimary")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              
              <Link 
                href="/#how-it-works" 
                className="group inline-flex items-center gap-2.5 rounded-full border border-ink-line/60 bg-ink-2/50 px-8 py-4 text-sm font-medium text-text backdrop-blur-md transition-all hover:border-text-muted hover:bg-ink-2"
              >
                {t("hero.ctaSecondary")}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={1} y={15}>
            <div className="mt-12 flex items-center gap-8 border-t border-ink-line/30 pt-8 w-full md:w-auto">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-faint">Network</span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-stamp-green" />
                  Arc Testnet
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-faint">Fee Architecture</span>
                <span className="text-sm font-medium">Native USDC Gas</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right Content — The Floating Receipt Mockup */}
        <Reveal delay={0.5} x={0} duration={1} className="w-full">
          <div className="relative mx-auto w-full max-w-sm sm:max-w-md px-2 sm:px-0">
            {/* Background Glows */}
            <div className="absolute -inset-10 -z-10">
              <div className="absolute inset-0 rounded-3xl bg-accent/10 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-paper-yellow/15 blur-[100px]" />
            </div>

            {/* Receipt Stack — Animated Floating */}
            <motion.div 
              animate={{ 
                y: [0, -10, 0],
                rotateZ: [0, 1, 0],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="group/receipt relative"
            >
              {/* Layer 3 (Bottom) */}
              <div className="absolute -inset-2 rotate-[3deg] rounded-2xl bg-paper-yellow/40 p-2 shadow-lg backdrop-blur-[2px]" />
              
              {/* Layer 2 (Middle) */}
              <div className="absolute -inset-1 rotate-[-2deg] rounded-2xl bg-paper-pink/50 p-2 shadow-xl backdrop-blur-[2px]" />
              
              {/* Layer 1 (Main Receipt) */}
              <div className="relative rounded-2xl bg-paper-white p-6 sm:p-8 text-paper-ink shadow-2xl">
                <div className="flex items-start justify-between border-b-2 border-dashed border-paper-ink/20 pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-ink text-paper-white font-display text-[12px] font-bold">N</div>
                      <p className="font-display text-base font-bold tracking-tight">NOTA SYSTEM</p>
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-paper-ink/40">Verified On-Chain Receipt</p>
                  </div>
                  <div className="grid grid-cols-8 gap-[3px]">
                    {QR_PATTERN.map((filled, i) => (
                      <motion.span 
                        key={i} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: filled ? 1 : 0 }}
                        transition={{ delay: 1.5 + i * 0.01 }}
                        className={cn("h-1.5 w-1.5 rounded-[1px] bg-paper-ink")} 
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-8 space-y-4 font-mono text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-paper-ink/50 italic">Merchant ID</span>
                    <span className="font-bold">#ARC-7721-X</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-paper-ink/50 italic">Payment Protocol</span>
                    <span className="font-bold text-accent">STABLE-Settlement</span>
                  </div>
                  <div className="my-5 border-t border-dashed border-paper-ink/20" />
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Amount</span>
                    <span>124.50 USDC</span>
                  </div>
                </div>

                <div className="relative mt-10 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] text-paper-ink/40 uppercase tracking-tighter italic">Block Height</span>
                    <span className="font-mono text-[11px] font-bold">#1,442,809</span>
                  </div>
                  <div className="relative">
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 2, type: "spring" }}
                      className="relative z-10 rotate-[-6deg] rounded-md border-2 sm:border-[3px] border-stamp-green px-2.5 sm:px-3.5 py-1 font-display text-[11px] sm:text-[13px] font-black tracking-widest text-stamp-green shadow-sm"
                    >
                      SUCCESS
                    </motion.div>
                    <div className="absolute -inset-2 bg-stamp-green/10 blur-md rounded-full" />
                  </div>
                </div>

                {/* Decorative notches */}
                <div className="absolute -bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-3 w-3 rounded-full bg-ink" />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
