"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Zap, Clock } from "lucide-react";

export function ScorePage() {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-2xl px-5 py-32 text-center">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-xl shadow-amber-500/5">
        <Clock className="h-10 w-10 animate-pulse" />
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-mono uppercase tracking-widest text-amber-400 mb-6">
        <Zap className="h-3.5 w-3.5" />
        Feature Status: Coming Soon
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
        Nota Score
      </h1>
      
      <p className="mt-4 text-lg text-text-muted leading-relaxed max-w-lg mx-auto">
        On-chain credit scoring & reputation engine is currently under active development. Build your payment history on Arc testnet to prepare for your score calculation!
      </p>

      <div className="mt-10 rounded-2xl border border-ink-line/60 bg-ink-2/40 p-6 backdrop-blur-xl max-w-md mx-auto text-left">
        <h3 className="font-display text-sm font-semibold text-text uppercase tracking-wider text-text-muted mb-3">
          What to expect:
        </h3>
        <ul className="space-y-2.5 text-sm text-text-muted">
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Dynamic reputation score based on Arc testnet activity
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Settlement reliability & transaction discipline metrics
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Unlocks perks in Arc DeFi & lending protocols
          </li>
        </ul>
      </div>
    </section>
  );
}
