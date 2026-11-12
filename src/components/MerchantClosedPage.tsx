"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Store, Clock, ArrowLeft, CreditCard } from "lucide-react";

/**
 * MerchantClosedPage : Tampilan pemberitahuan bahwa akses Merchant POS ditutup sementara.
 * Komponen ini menggantikan MerchantPage di route /merchant selama masa maintenance atau penutupan akses.
 * Mempertahankan styling Nota v2.0 (ink theme, rounded corners, border-ink-line).
 */
export function MerchantClosedPage() {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-2xl px-5 py-32 text-center">
      {/* Icon visual container : status peringatan maintenance */}
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-xl shadow-amber-500/5">
        <Store className="h-10 w-10 animate-pulse" />
      </div>

      {/* Badge status fitur : menginformasikan penutupan akses */}
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-mono uppercase tracking-widest text-amber-400 mb-6">
        <Clock className="h-3.5 w-3.5" />
        {t("merchant.closedBadge")}
      </div>

      {/* Judul utama halaman */}
      <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
        {t("merchant.closedTitle")}
      </h1>
      
      {/* Deskripsi penjelasan untuk user */}
      <p className="mt-4 text-lg text-text-muted leading-relaxed max-w-lg mx-auto">
        {t("merchant.closedDesc")}
      </p>

      {/* Tombol navigasi aksi alternatif untuk pengguna */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        {/* Navigasi kembali ke landing page */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("merchant.backToHome")}
        </Link>

        {/* Navigasi ke fitur pembayaran yang aktif (Scan & Pay) */}
        <Link
          href="/payment"
          className="inline-flex items-center gap-2 rounded-full bg-accent text-white px-6 py-3 text-sm font-medium hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
        >
          <CreditCard className="h-4 w-4" />
          {t("merchant.goToPayment")}
        </Link>
      </div>
    </section>
  );
}
