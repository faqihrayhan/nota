"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTransactions, type Transaction } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import ExportReport from "@/components/ExportReport";
import {
  BarChart3,
  Receipt,
  Calendar,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";


type Period = "week" | "month" | "all";

const CATEGORY_COLORS: Record<string, string> = {
  makan: "bg-paper-pink",
  transport: "bg-accent",
  belanja: "bg-paper-yellow",
  hiburan: "bg-warn-amber",
  kesehatan: "bg-stamp-green",
  lainnya: "bg-text-muted",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatUSDC(amount: number): string {
  return amount.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return new Date(0);
}

export default function AnalisaPage() {
  const wallet = useWallet();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

   const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!wallet.address) {
      setLoading(false); // Langsung matikan loading jika wallet disconnect
      return;
    }
    setLoading(true);
    getTransactions(wallet.address)
      .then((data) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [wallet.address]);

  // Demo Data jika wallet belum terhubung
  const DEMO_TRANSACTIONS: Transaction[] = [
    {
      id: "demo-1",
      payer_address: "0xdemo...1234",
      payee_address: "0xshop...5678",
      amount: 4.5,
      category: "makan",
      items: [{ name: "Ramen Special", price: -4.5 }],
      tx_hash: "0xdemo...tx1",
      block_hash: "",
      block_number: 55000000,
      status: "confirmed",
      mode: "payment",
      created_at: "2026-08-01T10:00:00.000Z",
    },
    {
      id: "demo-2",
      payer_address: "0xdemo...1234",
      payee_address: "0xstore...9999",
      amount: 12.0,
      category: "belanja",
      items: [{ name: "Kemeja Casual", price: -12.0 }],
      tx_hash: "0xdemo...tx2",
      block_hash: "",
      block_number: 55000001,
      status: "confirmed",
      mode: "payment",
      created_at: "2026-07-30T10:00:00.000Z",
    },
  ];

  const isConnected = Boolean(wallet.address);
  const currentAddr = (wallet.address || "").toLowerCase();
  const periodStart = getPeriodStart(period);

  // Jika wallet terhubung, filter berdasarkan address. Jika disconnect, tampilkan DEMO_TRANSACTIONS.
  const filtered = isConnected
    ? transactions.filter((t) => {
        const isPayer = t.payer_address.toLowerCase() === currentAddr;
        const isWithinPeriod = new Date(t.created_at) >= periodStart;
        return isPayer && isWithinPeriod;
      })
    : DEMO_TRANSACTIONS;

  const byCategory = filtered.reduce((acc, tx) => {
    const cat = tx.category || "lainnya";
    acc[cat] = (acc[cat] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalSpent = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const maxCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const byDay = filtered.reduce((acc, tx) => {
    const day = new Date(tx.created_at).toISOString().split("T")[0];
    acc[day] = (acc[day] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const sortedDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  const maxDayValue = Math.max(...Object.values(byDay), 1);


  return (
    <section className="relative mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <BarChart3 className="h-3 w-3" />
          {t("analisa.eyebrow")}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{t("analisa.title")}</h1>
        <p className="mt-2 text-text-muted">{t("analisa.desc")}</p>
      </div>

      <div className="flex gap-2">
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              period === p
                ? "bg-accent text-white"
                : "border border-ink-line/40 text-text-muted hover:text-text hover:bg-ink-2"
            )}
          >
            {t(`analisa.period.${p}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("analisa.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-ink-line/40 bg-ink-2/20 p-12 text-center">
          <Receipt className="mx-auto h-12 w-12 text-text-faint" />
          <h3 className="mt-4 font-display text-lg font-semibold">{t("analisa.emptyTitle")}</h3>
          <p className="mt-2 text-sm text-text-muted">{t("analisa.emptyDesc")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("analisa.totalSpent")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{formatUSDC(totalSpent)} USDC</p>
            </div>
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("analisa.transactions")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{filtered.length}</p>
            </div>
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <Tag className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("analisa.topCategory")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold capitalize">
                {maxCategory ? t(`payment.cat.${maxCategory[0]}`) : "—"}
              </p>
            </div>
          </div>

          <ExportReport
            transactions={isConnected ? transactions : DEMO_TRANSACTIONS}
            disabled={!isConnected}
          />

          <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
            <h3 className="font-display text-sm font-semibold">{t("analisa.byCategory")}</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => {
                  const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 capitalize">
                          <span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_COLORS[cat] || "bg-text-muted")} />
                          {t(`payment.cat.${cat}`)}
                        </span>
                        <span className="font-mono">{formatUSDC(amount)} USDC ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-ink-2 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", CATEGORY_COLORS[cat] || "bg-text-muted")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

                  <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
            <h3 className="font-display text-sm font-semibold">{t("analisa.recentTx")}</h3>
            <div className="mt-4 space-y-2">
              {filtered.slice(0, 10).map((tx) => {
                const isExpanded = expandedTx === tx.id;
                return (
                  <div
                    key={tx.id}
                    onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                    className="cursor-pointer rounded-xl border border-ink-line/30 bg-ink-2/30 p-4 transition-all hover:border-ink-line/60 hover:bg-ink-2/60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", CATEGORY_COLORS[tx.category] || "bg-text-muted", "bg-opacity-20")}>
                          <Receipt className="h-4 w-4 text-text" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{t(`payment.cat.${tx.category}`)}</p>
                          <p className="text-xs text-text-faint font-mono">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                       <span className="font-mono text-sm font-medium">
                        {tx.payer_address.toLowerCase() === currentAddr ? "-" : "+"}{formatUSDC(tx.amount)} USDC
                      </span>

                    </div>

                                     {/* Expand Rincian Item Belanjaan & Link ArcScan */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-ink-line/20 pt-3 text-xs space-y-3">
                        {tx.items && tx.items.length > 0 && (
                          <div>
                            <p className="font-medium text-text-muted mb-1.5">{t("analisa.itemDetails")}</p>
                            <div className="space-y-1">
                              {tx.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-text-muted">
                                  <span>• {item.name}</span>
                                  <span className="font-mono">{formatUSDC(item.price)} USDC</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {tx.tx_hash && (
                          <div className="flex items-center justify-between pt-1">
                            <a
                              href={`https://testnet.arcscan.app/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-mono text-accent hover:text-accent-strong transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>{t("analisa.viewArcScan")}</span>
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptTx(tx);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line/40 px-3 py-1.5 font-mono text-xs text-text-muted hover:border-accent/50 hover:text-accent transition-all"
                            >
                              <FileText className="h-3 w-3" />
                              <span>{t("analisa.viewReceipt")}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <ReceiptModal tx={receiptTx} onClose={() => setReceiptTx(null)} />
    </section>
  );
}