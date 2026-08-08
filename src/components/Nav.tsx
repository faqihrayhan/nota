"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  BookOpen, FileText, Code, HelpCircle, ExternalLink, ChevronDown,
  CreditCard, BarChart3, TrendingUp, Layers,
} 


from "lucide-react";

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const docsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { t } = useLanguage();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (docsRef.current && !docsRef.current.contains(e.target as Node)) {
        setDocsOpen(false);
      }
      if (featuresRef.current && !featuresRef.current.contains(e.target as Node)) {
        setFeaturesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const featureItems = [
    { icon: CreditCard, title: t("nav.payment"), desc: t("features.payment.desc"), href: "/payment" },
    { icon: BarChart3, title: t("nav.analisa"), desc: t("features.analisa.desc"), href: "/analisa" },
    { icon: TrendingUp, title: t("nav.forecast"), desc: t("features.forecast.desc"), href: "/forecast" },
  ];

  const docsItems = [
    { icon: BookOpen, title: "Documentation", desc: "Guides & API reference", href: "#docs", tag: "New" },
    { icon: Code, title: "API Reference", desc: "Endpoints & SDK", href: "#api" },
    { icon: FileText, title: "Whitepaper", desc: "Technical overview", href: "#whitepaper" },
    { icon: HelpCircle, title: "FAQ", desc: "Common questions", href: "#faq" },
  ];

  return (
    <header className={cn("sticky top-0 z-50 transition-all duration-500", scrolled || menuOpen ? "border-b border-ink-line/60 bg-ink/95 backdrop-blur-2xl shadow-[0_1px_40px_-12px_rgba(0,0,0,0.4)]" : "border-b border-transparent bg-ink/50 backdrop-blur-md")}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5 transition-all duration-300">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper-white font-display text-sm font-bold text-paper-ink shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:shadow-paper-white/10 group-hover:scale-105 group-hover:rotate-[-3deg]">N</span>
          <span className="font-display text-lg font-semibold tracking-tight text-text transition-colors duration-300 group-hover:text-text/80">Nota</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {/* How it works — scroll ke section */}
          <Link
            href="/#how-it-works"
            className="relative px-4 py-2 text-sm rounded-xl transition-all duration-300 group flex items-center gap-2 text-text-muted hover:text-text hover:bg-white/[0.03]"
          >
            <Layers className="h-4 w-4" />
            <span className="relative z-10">{t("nav.howItWorks")}</span>
          </Link>

          {/* Features Dropdown */}
          <div className="relative" ref={featuresRef}>
            <button
              onClick={() => setFeaturesOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-all duration-300",
                featuresOpen ? "text-text bg-white/[0.06]" : "text-text-muted hover:text-text hover:bg-white/[0.03]"
              )}
            >
              <span>{t("nav.features")}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", featuresOpen && "rotate-180")} />
            </button>
            <div
              className={cn(
                "absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 overflow-hidden rounded-2xl border border-ink-line/60 bg-ink-2/95 backdrop-blur-2xl shadow-2xl shadow-black/40 transition-all duration-300 origin-top",
                featuresOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
              )}
            >
              <div className="p-2">
                {featureItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={() => setFeaturesOpen(false)}
                    className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-all duration-200 hover:bg-white/[0.04]"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-3 border border-ink-line/40 text-text-muted transition-all duration-200 group-hover:text-text group-hover:border-ink-line/60">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text">{item.title}</span>
                      <p className="mt-0.5 text-xs text-text-muted line-clamp-1">{item.desc}</p>
                    </div>
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-text-faint opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-text-muted" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Docs Dropdown */}
          <div className="relative" ref={docsRef}>
            <button onClick={() => setDocsOpen((v) => !v)} className={cn("flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-all duration-300", docsOpen ? "text-text bg-white/[0.06]" : "text-text-muted hover:text-text hover:bg-white/[0.03]")}>
              <span>Docs</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", docsOpen && "rotate-180")} />
            </button>
            <div className={cn("absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 overflow-hidden rounded-2xl border border-ink-line/60 bg-ink-2/95 backdrop-blur-2xl shadow-2xl shadow-black/40 transition-all duration-300 origin-top", docsOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none")}>
              <div className="p-2">
                {docsItems.map((item) => (
                  <Link key={item.title} href={item.href} onClick={() => setDocsOpen(false)} className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-all duration-200 hover:bg-white/[0.04]">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-3 border border-ink-line/40 text-text-muted transition-all duration-200 group-hover:text-text group-hover:border-ink-line/60">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{item.title}</span>
                        {item.tag && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{item.tag}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
                    </div>
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-text-faint opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-text-muted" />
                  </Link>
                ))}
              </div>
              <div className="border-t border-ink-line/40 px-4 py-3">
                <Link href="https://github.com/faqihrayhan/arc-nota" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-text-muted hover:text-text transition-colors">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>View on GitHub</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <div className="flex items-center rounded-xl border border-ink-line/40 p-0.5"><LanguageToggle /></div>
          <div className="flex items-center"><ThemeToggle /></div>
          <div className="w-px h-6 bg-ink-line/40 mx-0.5" />
            <div className="flex items-center gap-2"> <WalletButton />
          </div>

        </div>

        <button onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? "Tutup menu" : "Buka menu"} aria-expanded={menuOpen} className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-ink-line/60 hover:border-ink-line hover:bg-white/[0.03] transition-all duration-300">
          <div className="relative h-5 w-5">
            <span className={cn("absolute left-0 top-1 h-[2px] w-5 bg-text rounded-full transition-all duration-300 origin-center", menuOpen && "top-1/2 -translate-y-1/2 rotate-45")} />
            <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-text rounded-full transition-all duration-300", menuOpen ? "w-0 opacity-0" : "w-5 opacity-100")} />
            <span className={cn("absolute left-0 bottom-1 h-[2px] w-5 bg-text rounded-full transition-all duration-300 origin-center", menuOpen && "bottom-1/2 translate-y-1/2 -rotate-45")} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      <div className={cn("md:hidden overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", menuOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0")}>
        <div className="relative border-t border-ink-line/40 px-5 py-5 space-y-1">
          <Link href="/#how-it-works" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm rounded-xl text-text-muted hover:text-text hover:bg-white/[0.03] transition-all duration-300">
            <Layers className="h-4 w-4 text-text-faint" />
            <span className="font-medium">{t("nav.howItWorks")}</span>
          </Link>

          <div className="pt-2">
            <p className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-faint">{t("nav.features")}</p>
            {featureItems.map((item) => (
              <Link key={item.title} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-muted hover:text-text hover:bg-white/[0.03] rounded-xl transition-all duration-200">
                <item.icon className="h-4 w-4 text-text-faint" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>

          <div className="pt-2">
            <p className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-faint">Documentation</p>
            {docsItems.map((item) => (
              <Link key={item.title} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-muted hover:text-text hover:bg-white/[0.03] rounded-xl transition-all duration-200">
                <item.icon className="h-4 w-4 text-text-faint" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-ink-line/40 flex items-center gap-3">
            <div className="flex-1 flex justify-center"><LanguageToggle /></div>
            <div className="flex-1 flex justify-center"><ThemeToggle /></div>
          </div>
          <div className="mt-3"><WalletButton compact /></div>
        </div>
      </div>
    </header>
  );
}