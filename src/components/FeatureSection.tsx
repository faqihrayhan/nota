"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";
import { 
  CreditCard, 
  BarChart3, 
  TrendingUp, 
  Activity, 
  ArrowRight, 
  Sparkles,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PILARS = [
  {
    id: "pilar1",
    icon: CreditCard,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
    href: "/payment",
    active: true,
  },
  {
    id: "pilar2",
    icon: BarChart3,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    href: "/analisa",
    active: true,
  },
  {
    id: "pilar3",
    icon: TrendingUp,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
    href: "/forecast",
    active: true,
  },
  {
    id: "pilar4",
    icon: Activity,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
    href: "#",
    active: false,
  },
];

export function FeatureSection() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(PILARS[0]);

  return (
    <section id="how-it-works" className="relative border-t border-ink-line/40 bg-ink-2/30 py-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,var(--ink-line)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          {/* Left Column */}
          <div className="flex flex-col">
            <Reveal delay={0.1}>
              <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-text-muted">
                <Sparkles className="h-3 w-3" />
                {t("features.eyebrow")}
              </div>
            </Reveal>
            
            <Reveal delay={0.2}>
              <h2 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                {t("features.title")}
              </h2>
            </Reveal>

            <Reveal delay={0.3}>
              <p className="mt-6 text-lg text-text-muted leading-relaxed">
                {t("features.desc")}
              </p>
            </Reveal>

            {/* Pillar List Card Stack */}
            <div className="mt-12 space-y-3">
              {PILARS.map((p, i) => (
                <Reveal key={p.id} delay={0.4 + i * 0.1} y={15} width="100%">
                  <button
                    onClick={() => setActiveTab(p)}
                    className={cn(
                      "group relative grid w-full items-center rounded-2xl border p-5 transition-all duration-300 min-h-[5.25rem]",
                      "grid-cols-[3rem_1fr_1.5rem] gap-4 text-left",
                      activeTab.id === p.id
                        ? "border-accent bg-accent/5 shadow-lg shadow-accent/5"
                        : "border-ink-line/40 bg-transparent hover:border-ink-line hover:bg-ink-2/50"
                    )}
                  >
                    {/* Icon Tile */}
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-300 shrink-0",
                      activeTab.id === p.id ? "bg-accent border-accent text-white" : cn("bg-ink-3 border-ink-line", p.color)
                    )}>
                      <p.icon className="h-5 w-5" />
                    </div>

                    {/* Text Container */}
                    <div className="flex flex-col justify-center min-w-0">
                      <h3 className={cn(
                        "font-display text-lg font-semibold transition-colors truncate leading-tight",
                        activeTab.id === p.id ? "text-text" : "text-text-muted group-hover:text-text"
                      )}>
                        {t(`features.${p.id}.title`)}
                      </h3>
                      <span className={cn(
                        "mt-1 block text-[10px] font-mono uppercase tracking-[0.2em] text-accent font-medium h-4",
                        activeTab.id === p.id ? "opacity-100" : "opacity-0"
                      )}>
                        {p.active ? `${t("features.core")} ${String(i + 1).padStart(2, "0")}` : t("features.comingSoon")}
                      </span>
                    </div>

                    {/* Right Chevron */}
                    <ChevronRight className={cn(
                      "h-5 w-5 justify-self-end transition-all duration-300",
                      activeTab.id === p.id ? "opacity-100 text-accent translate-x-0" : "opacity-0 -translate-x-2"
                    )} />
                  </button>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.id}
                initial={{ opacity: 0, scale: 0.95, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden rounded-[2.5rem] border border-ink-line/60 bg-ink-2 p-2 shadow-2xl"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[2rem] bg-ink relative">
                  <div className={cn("absolute inset-0 opacity-10 blur-[80px]", activeTab.bgColor)} />
                  
                  <div className="relative h-full w-full p-12 flex flex-col justify-center items-center text-center">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className={cn("mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border-2 shadow-2xl", activeTab.bgColor, activeTab.borderColor)}
                    >
                      <activeTab.icon className={cn("h-10 w-10", activeTab.color)} />
                    </motion.div>
                    
                    <motion.h4 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="font-display text-3xl font-bold"
                    >
                      {t(`features.${activeTab.id}.title`)}
                    </motion.h4>
                    
                    <motion.p 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mt-6 max-w-md text-lg text-text-muted"
                    >
                      {t(`features.${activeTab.id}.desc`)}
                    </motion.p>
                    
                    {activeTab.active && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <a 
                          href={activeTab.href}
                          className="mt-10 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
                        >
                          {t("features.open")}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </motion.div>
                    )}
                  </div>

                  <div className="absolute top-6 left-8 flex gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-ink-line/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-ink-line/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-ink-line/60" />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
