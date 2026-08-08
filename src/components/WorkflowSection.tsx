"use client";

import { Reveal } from "@/components/Reveal";
import { Wallet, QrCode, FileCheck } from "lucide-react";

export function WorkflowSection() {
  const steps = [
    {
      num: "01",
      icon: Wallet,
      title: "Hubungkan Wallet",
      desc: "Konek wallet MetaMask atau OKX Anda yang terhubung ke Arc Testnet dalam satu klik.",
    },
    {
      num: "02",
      icon: QrCode,
      title: "Scan & Bayar USDC",
      desc: "Tampilkan QR code pembayaran. Proses transfer USDC instan dengan gas fee native USDC.",
    },
    {
      num: "03",
      icon: FileCheck,
      title: "Terima Nota & Laporan",
      desc: "Transaksi otomatis tercatat sebagai nota digital. Unduh PDF/PNG atau ekspor CSV kapan saja.",
    },
  ];

  return (
    <section className="relative py-28 border-b border-ink-line/40 bg-ink">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <Reveal delay={0.1}>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-accent">Alur Kerja Cepat</span>
          </Reveal>
          <Reveal delay={0.2}>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">3 Langkah Sederhana</h2>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-3 text-text-muted">Kemudahan transaksi tanpa ribet input data manual.</p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={i} delay={0.2 + i * 0.15} y={20}>
              <div className="relative h-full rounded-2xl border border-ink-line/40 bg-ink-2/40 p-8 hover:border-accent/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-ink-line/60">{s.num}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
