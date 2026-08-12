"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTransactions, getIncomingTransactions, type Transaction } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Wallet,
  Loader2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Receipt,
} from "lucide-react";

type Period = "month" | "quarter" | "all";

function formatUSDC(amount: number): string {
  return amount.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  if (period === "quarter") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  return new Date(0);
}

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  makan: "bg-paper-pink",
  transport: "bg-accent",
  belanja: "bg-paper-yellow",
  hiburan: "bg-warn-amber",
  kesehatan: "bg-stamp-green",
  lainnya: "bg-text-muted",
};

const CATEGORY_ICONS: Record<string, string> = {
  makan: "🍽️",
  transport: "🚗",
  belanja: "🛒",
  hiburan: "🎬",
  kesehatan: "💊",
  lainnya: "📦",
};

export default function ForecastPage() {
  const wallet = useWallet();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incoming, setIncoming] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet.address) return;
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

  const periodStart = getPeriodStart(period);
  const filtered = transactions.filter((t) => new Date(t.created_at) >= periodStart);

  const monthlyData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    transactions.forEach((tx) => {
      const month = getMonthKey(tx.created_at);
      const cat = tx.category || "lainnya";
      if (!data[month]) data[month] = {};
      data[month][cat] = (data[month][cat] || 0) + tx.amount;
    });
    return data;
  }, [transactions]);

  const months = Object.keys(monthlyData).sort();

  const categoryTrends = useMemo(() => {
    if (months.length < 2) return {};
    const trends: Record<string, { avg: number; trend: number; forecast: number; lastValue: number }> = {};
    const categories = new Set<string>();

    months.forEach((m) => {
      Object.keys(monthlyData[m]).forEach((c) => categories.add(c));
    });

    categories.forEach((cat) => {
      const values = months.map((m) => monthlyData[m][cat] || 0);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;

      const lastValue = values[values.length - 1] || 0;
      const prevValue = values[values.length - 2] || lastValue;
      const trend = prevValue === 0 ? 0 : ((lastValue - prevValue) / prevValue) * 100;

      const forecast = lastValue * (1 + (trend / 100) * 0.5);

      trends[cat] = { avg, trend, forecast: Math.max(0, forecast), lastValue };
    });

    return trends;
  }, [monthlyData, months]);

  const totalForecast = Object.values(categoryTrends).reduce((sum, t) => sum + t.forecast, 0);
  const totalAvg = Object.values(categoryTrends).reduce((sum, t) => sum + t.avg, 0);

  // Inflow projection (payments received to this wallet)
  const monthlyInflow = useMemo(() => {
    const data: Record<string, number> = {};
    incoming.forEach((tx) => {
      if (tx.status === "failed") return;
      const month = getMonthKey(tx.created_at);
      data[month] = (data[month] || 0) + tx.amount;
    });
    return data;
  }, [incoming]);

  const inflowMonths = Object.keys(monthlyInflow).sort();
  const totalInflow = Object.values(monthlyInflow).reduce((a, b) => a + b, 0);
  const avgInflow = inflowMonths.length > 0 ? totalInflow / inflowMonths.length : 0;
  const inflowForecast = inflowMonths.length >= 2
    ? (monthlyInflow[inflowMonths[inflowMonths.length - 1]] || 0) * 1.05
    : avgInflow;

  if (!wallet.address) {
    return (
      <section className="relative mx-auto max-w-4xl px-5 py-24">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line/40 bg-ink-2/30 p-12 text-center">
          <Wallet className="h-12 w-12 text-text-muted" />
          <h2 className="mt-4 font-display text-xl font-semibold">{t("forecast.connectFirst")}</h2>
          <p className="mt-2 text-sm text-text-muted">{t("forecast.connectDesc")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <TrendingUp className="h-3 w-3" />
          {t("forecast.eyebrow")}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{t("forecast.title")}</h1>
        <p className="mt-2 text-text-muted">{t("forecast.desc")}</p>
      </div>

      <div className="flex gap-2">
        {(["month", "quarter", "all"] as Period[]).map((p) => (
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
            {t(`forecast.period.${p}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("forecast.loading")}
        </div>
      ) : transactions.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-ink-line/40 bg-ink-2/20 p-12 text-center">
          <Receipt className="mx-auto h-12 w-12 text-text-faint" />
          <h3 className="mt-4 font-display text-lg font-semibold">{t("forecast.emptyTitle")}</h3>
          <p className="mt-2 text-sm text-text-muted">{t("forecast.emptyDesc")}</p>
        </div>
      ) : months.length < 2 ? (
        <div className="mt-12 rounded-2xl border border-ink-line/40 bg-ink-2/20 p-12 text-center">
          <Lightbulb className="mx-auto h-12 w-12 text-text-faint" />
          <h3 className="mt-4 font-display text-lg font-semibold">{t("forecast.needMoreData")}</h3>
          <p className="mt-2 text-sm text-text-muted">{t("forecast.needMoreDataDesc")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("forecast.avgSpent")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{formatUSDC(totalAvg)} USDC</p>
              <p className="mt-1 text-xs text-text-faint">{t("forecast.perMonth")}</p>
            </div>
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("forecast.nextMonth")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold text-accent">{formatUSDC(totalForecast)} USDC</p>
              <p className="mt-1 text-xs text-text-faint">{t("forecast.projected")}</p>
            </div>
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("forecast.avgInflow")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold text-stamp-green">{formatUSDC(avgInflow)} USDC</p>
              <p className="mt-1 text-xs text-text-faint">{t("forecast.perMonthInflow")}</p>
            </div>
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <div className="flex items-center gap-2 text-text-muted">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-mono uppercase">{t("forecast.nextInflow")}</span>
              </div>
              <p className="mt-2 font-display text-2xl font-semibold text-stamp-green">{formatUSDC(inflowForecast)} USDC</p>
              <p className="mt-1 text-xs text-text-faint">{t("forecast.projectedInflow")}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
            <h3 className="font-display text-sm font-semibold">{t("forecast.byCategory")}</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(categoryTrends)
                .sort((a, b) => b[1].forecast - a[1].forecast)
                .map(([cat, data]) => {
                  const pct = totalForecast > 0 ? (data.forecast / totalForecast) * 100 : 0;
                  const isUp = data.trend > 0;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="flex items-center gap-2 capitalize">
                          <span className="text-base">{CATEGORY_ICONS[cat] || "📦"}</span>
                          {t(`payment.cat.${cat}`)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs">
                            {isUp ? (
                              <ArrowUpRight className="h-3 w-3 text-warn-amber" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-stamp-green" />
                            )}
                            <span className={isUp ? "text-warn-amber" : "text-stamp-green"}>
                              {Math.abs(data.trend).toFixed(1)}%
                            </span>
                          </span>
                          <span className="font-mono">{formatUSDC(data.forecast)} USDC</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-ink-2 overflow-hidden">
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

          {months.length > 1 && (
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <h3 className="font-display text-sm font-semibold">{t("forecast.monthlyHistory")}</h3>
              <div className="mt-4 flex items-end gap-2 h-40">
                {months.map((month) => {
                  const monthTotal = Object.values(monthlyData[month]).reduce((a, b) => a + b, 0);
                  const maxMonth = Math.max(...months.map((m) => Object.values(monthlyData[m]).reduce((a, b) => a + b, 0)), 1);
                  const height = Math.max(8, (monthTotal / maxMonth) * 100);
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-2">
                      <div className="relative w-full flex items-end justify-center" style={{ height: "120px" }}>
                        <div
                          className="w-full max-w-[48px] rounded-t-lg bg-accent/50 hover:bg-accent transition-colors relative group"
                          style={{ height: `${height}%` }}
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink-2 border border-ink-line/40 rounded-lg px-2 py-1 text-xs font-mono whitespace-nowrap z-10">
                            {formatUSDC(monthTotal)} USDC
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-text-faint font-mono">{month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-paper-yellow/30 bg-paper-yellow/5 p-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-paper-yellow" />
              <div>
                <h3 className="font-display text-sm font-semibold">{t("forecast.insightTitle")}</h3>
                <p className="mt-2 text-sm text-text-muted leading-relaxed">
                  {t("forecast.insightDesc")}
                </p>
                {inflowMonths.length > 0 && (
                  <p className="mt-2 text-sm text-text-muted leading-relaxed">
                    {t("forecast.insightInflow")} <strong className="text-stamp-green">{formatUSDC(avgInflow)} USDC</strong>{" "}
                    {t("forecast.perMonthInflow")}
                    {inflowForecast > avgInflow && avgInflow > 0
                      ? ` · ${t("forecast.insightInflowUp")} ${((inflowForecast - avgInflow) / avgInflow * 100).toFixed(0)}%`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
