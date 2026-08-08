"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { Transaction } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";

type StatusFilter = "all" | "confirmed" | "pending" | "failed";

/**
 * ExportReport — export riwayat transaksi ke CSV (client-side Blob).
 *
 * Keamanan (CSV injection / formula injection):
 * - Setiap cell yang diawali karakter berbahaya (=, +, -, @, tab, CR)
 *   di-prefix dengan apostrof (`'`) supaya tidak dieksekusi sebagai
 *   formula oleh spreadsheet (OWASP CSV Injection).
 * - Cell yang mengandung koma, quote, atau newline dibungkus double-quote.
 */
function sanitizeCsvCell(value: string | number): string {
  let str = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\n");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExportReport({
  transactions,
  disabled,
}: {
  transactions: Transaction[];
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (status !== "all" && tx.status !== status) return false;
      const ts = new Date(tx.created_at).getTime();
      if (fromDate && ts < new Date(`${fromDate}T00:00:00`).getTime()) return false;
      if (toDate && ts > new Date(`${toDate}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [transactions, fromDate, toDate, status]);

  const totalAmount = filtered.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const handleExport = () => {
    if (filtered.length === 0) return;
    setExporting(true);
    setDone(false);

    try {
      const header = [
        t("export.date"),
        t("export.txHash"),
        t("export.category"),
        t("export.items"),
        t("export.amount"),
        t("export.status"),
        t("export.mode"),
        t("export.payer"),
        t("export.payee"),
      ];

      const rows = filtered.map((tx) => [
        formatDateTime(tx.created_at),
        tx.tx_hash,
        t(`payment.cat.${tx.category}`),
        tx.items?.map((i) => i.name).join("; ") || "",
        tx.amount,
        tx.status,
        tx.mode,
        tx.payer_address,
        tx.payee_address,
      ]);

      // Blob client-side — tidak ada upload ke server.
      const blob = new Blob(["\uFEFF" + toCsv([header, ...rows])], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nota-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-accent" />
        <h3 className="font-display text-sm font-semibold">{t("export.title")}</h3>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">{t("export.from")}</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-ink-line/50 bg-ink-2 px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">{t("export.to")}</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-ink-line/50 bg-ink-2 px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">{t("export.statusFilter")}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="w-full rounded-lg border border-ink-line/50 bg-ink-2 px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
          >
            <option value="all">{t("export.statusAll")}</option>
            <option value="confirmed">{t("export.statusConfirmed")}</option>
            <option value="pending">{t("export.statusPending")}</option>
            <option value="failed">{t("export.statusFailed")}</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          {t("export.count")}: <span className="font-mono font-medium text-text">{filtered.length}</span>
          {" · "}
          {t("export.total")}:{" "}
          <span className="font-mono font-medium text-text">
            {totalAmount.toLocaleString("id-ID", { maximumFractionDigits: 6 })} USDC
          </span>
        </p>
        <button
          onClick={handleExport}
          disabled={disabled || exporting || filtered.length === 0}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all",
            "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {t("export.download")}
        </button>
      </div>
    </div>
  );
}
