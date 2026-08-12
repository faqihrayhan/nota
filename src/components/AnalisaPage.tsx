"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTransactions, getIncomingTransactions, type Transaction } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import ExportReport from "@/components/ExportReport";
import {
  BarChart3,
  Receipt,
  Calendar,
  Tag,
  Loader2,
  ExternalLink,
  FileText,
  TrendingUp,
  ArrowDownCircle,
  Scale,
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
   const [incoming, setIncoming] = useState<Transaction[]>([]);

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
     getIncomingTransactions(wallet.address)
       .then(setIncoming)
       .catch(() => {});
   }, [wallet.address]);

  // Demo Data jika wallet belum terhubung
  const DEMO_TRANSACTIONS: Transaction[] = [
    {
      id: "demo-1",
      wallet_address: "0xdemo0000000000000000000000000000000001",
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
      wallet_address: "0xdemo0000000000000000000000000000000001",
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

  // ── Cashflow (Phase 5+) ────────────────────────────────────────
  // outflow = transactions where I'm the payer (existing filtered list)
  // inflow  = transactions where I'm the payee (incoming)
  const inflowFiltered = incoming.filter((t) => {
    const isPayee = t.payee_address.toLowerCase() === currentAddr;
    const isWithinPeriod = new Date(t.created_at) >= periodStart;
    return isPayee && isWithinPeriod && t.status !== "failed";
  });

  const totalInflow = inflowFiltered.reduce((s, t) => s + t.amount, 0);
  const totalOutflow = filtered.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalInflow - totalOutflow;

  // Daily inflow/outflow pairs for the trend chart
  const daySet = new Set([
    ...sortedDays.map(([d]) => d),
    ...inflowFiltered.map((t) => new Date(t.created_at).toISOString().split("T")[0]),
  ]);
  const trendDays = [...daySet].sort();
  const byInflowDay = inflowFiltered.reduce((acc, tx) => {
    const day = new Date(tx.created_at).toISOString().split("T")[0];
    acc[day] = (acc[day] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);
  const trendData = trendDays.map((day) => ({
    day,
    inflow: byInflowDay[day] || 0,
    outflow: byDay[day] || 0,
  }));
  const maxTrendValue = Math.max(...trendData.flatMap((d) => [d.inflow, d.outflow]), 1);

  // Insight helpers
  const dayLabels = trendDays.map((d) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  });
  const insightInflow = totalInflow > 0;
  const insightOutflow = totalOutflow > 0;
  const insightNet = Math.abs(netBalance) > 0.0001;
  const topInflowSource = inflowFiltered.reduce((acc, t) => {
    const from = t.payer_address.toLowerCase();
    acc[from] = (acc[from] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
  const topInflowSourceEntry = Object.entries(topInflowSource).sort((a, b) => b[1] - a[1])[0];
  const busiestDay = trendData.slice().sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow))[0];


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
          {/* Cashflow Overview — inflow / outflow / net */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stamp-green/30 bg-ink p-6">
              <div className="flex items-center gap-2 text-stamp-green">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("analisa.inflow")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{formatUSDC(totalInflow)} USDC</p>
              <p className="mt-1 text-xs text-text-muted">{t("analisa.inflowDesc")}</p>
            </div>
            <div className="rounded-2xl border border-warn-amber/30 bg-ink p-6">
              <div className="flex items-center gap-2 text-warn-amber">
                <ArrowDownCircle className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("analisa.outflow")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{formatUSDC(totalOutflow)} USDC</p>
              <p className="mt-1 text-xs text-text-muted">{t("analisa.outflowDesc")}</p>
            </div>
            <div className={cn("rounded-2xl border bg-ink p-6", netBalance >= 0 ? "border-accent/40" : "border-warn-amber/40")}>
              <div className={cn("flex items-center gap-2", netBalance >= 0 ? "text-accent" : "text-warn-amber")}>
                <Scale className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("analisa.netBalance")}</span>
              </div>
              <p className={cn("mt-2 font-display text-2xl font-semibold", netBalance >= 0 ? "text-accent" : "text-warn-amber")}>
                {netBalance >= 0 ? "+" : ""}{formatUSDC(netBalance)} USDC
              </p>
              <p className="mt-1 text-xs text-text-muted">{t("analisa.netDesc")}</p>
            </div>
          </div>

          {/* Cashflow trend chart (inflow vs outflow per day) */}
          {trendData.length > 0 && (
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <h3 className="font-display text-sm font-semibold">{t("analisa.cashflowTrend")}</h3>
              <p className="mt-1 text-xs text-text-muted">{t("analisa.cashflowTrendDesc")}</p>
              <div className="mt-5 flex h-40 items-end gap-3 overflow-x-auto pb-1">
                {trendData.map((d, i) => (
                  <div key={d.day} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end justify-center gap-1">
                      <div
                        className="w-3 rounded-t bg-stamp-green/80 transition-all duration-500"
                        style={{ height: `${(d.inflow / maxTrendValue) * 100}%`, minHeight: d.inflow > 0 ? 4 : 0 }}
                        title={`${t("analisa.inflow")}: ${formatUSDC(d.inflow)}`}
                      />
                      <div
                        className="w-3 rounded-t bg-warn-amber/80 transition-all duration-500"
                        style={{ height: `${(d.outflow / maxTrendValue) * 100}%`, minHeight: d.outflow > 0 ? 4 : 0 }}
                        title={`${t("analisa.outflow")}: ${formatUSDC(d.outflow)}`}
                      />
                    </div>
                    <span className="text-[10px] text-text-faint">{dayLabels[i]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-stamp-green" /> {t("analisa.inflow")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-warn-amber" /> {t("analisa.outflow")}
                </span>
              </div>
            </div>
          )}

          {/* Auto insights */}
          {(insightInflow || insightOutflow) && (
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
              <h3 className="font-display text-sm font-semibold text-accent">{t("analisa.insightTitle")}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {insightOutflow && (
                  <li className="flex items-start gap-2 text-text">
                    <span className="mt-0.5 text-warn-amber">●</span>
                    <span>
                      {t("analisa.insightTopCategory")}{" "}
                      <strong className="capitalize">{maxCategory ? t(`payment.cat.${maxCategory[0]}`) : "—"}</strong>{" "}
                      ({maxCategory ? ((maxCategory[1] / Math.max(totalOutflow, 0.0001)) * 100).toFixed(0) : 0}%{" "}
                      {t("analisa.insightOfOutflow")})
                    </span>
                  </li>
                )}
                {insightInflow && topInflowSourceEntry && (
                  <li className="flex items-start gap-2 text-text">
                    <span className="mt-0.5 text-stamp-green">●</span>
                    <span>
                      {t("analisa.insightTopSource")}{" "}
                      <strong className="font-mono text-xs">
                        {topInflowSourceEntry[0].slice(0, 10)}…{topInflowSourceEntry[0].slice(-6)}
                      </strong>{" "}
                      ({formatUSDC(topInflowSourceEntry[1])} USDC)
                    </span>
                  </li>
                )}
                {busiestDay && (busiestDay.inflow + busiestDay.outflow) > 0 && (
                  <li className="flex items-start gap-2 text-text">
                    <span className="mt-0.5 text-accent">●</span>
                    <span>
                      {t("analisa.insightBusiestDay")}{" "}
                      <strong>{dayLabels[trendData.indexOf(busiestDay)]}</strong> —{" "}
                      {formatUSDC(busiestDay.inflow + busiestDay.outflow)} USDC
                    </span>
                  </li>
                )}
                {insightNet && (
                  <li className="flex items-start gap-2 text-text">
                    <span className={cn("mt-0.5", netBalance >= 0 ? "text-accent" : "text-warn-amber")}>●</span>
                    <span>
                      {netBalance >= 0 ? t("analisa.insightNetPositive") : t("analisa.insightNetNegative")}{" "}
                      <strong>{formatUSDC(Math.abs(netBalance))} USDC</strong>
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

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