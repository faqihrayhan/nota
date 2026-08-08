"use client";

import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/context/LanguageContext";

export function StatsSection() {
  const { t } = useLanguage();

  const stats = [
    { label: "Jaringan Network", value: "Arc Testnet", desc: "Chain ID 5042002" },
    { label: "Kecepatan Settlement", value: "< 1 Detik", desc: "Transaksi Instan" },
    { label: "Akurasi Pembukuan", value: "100% On-Chain", desc: "Otomatis & Terverifikasi" },
    { label: "Standard Format", value: "PDF & CSV", desc: "Format Ekspor Resmi" },
  ];

  return (
    <section className="relative border-y border-ink-line/40 bg-ink-2/40 py-16 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 0.1} y={15}>
              <div className="flex flex-col border-l-2 border-accent/40 pl-5">
                <span className="text-xs font-mono uppercase tracking-widest text-text-faint">{s.label}</span>
                <span className="mt-2 font-display text-2xl font-bold text-text sm:text-3xl">{s.value}</span>
                <span className="mt-1 text-xs text-text-muted">{s.desc}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
