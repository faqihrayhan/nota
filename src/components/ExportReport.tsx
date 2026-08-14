"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { type Transaction } from "@/lib/supabase";
import { FileSpreadsheet, Download, Loader2, CheckCircle2, FileText } from "lucide-react";

type StatusFilter = "all" | "confirmed" | "failed";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toCsv(rows: any[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "").replace(/"/g, '""');
          return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
        })
        .join(",")
    )
    .join("\n");
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
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
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

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [filtered]);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    setExportingCsv(true);
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
      setExportingCsv(false);
    }
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) return;
    setExportingPdf(true);
    setDone(false);

    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text("Nota — Accounting Report", 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`Summary: ${filtered.length} transactions, Total: ${totalAmount.toFixed(2)} USDC`, 14, 37);

      const header = [
        t("export.date"),
        t("export.category"),
        t("export.amount"),
        t("export.status"),
      ];

      const rows = filtered.map((tx) => [
        formatDateTime(tx.created_at).split(",")[0],
        t(`payment.cat.${tx.category}`),
        `${tx.amount} USDC`,
        tx.status,
      ]);

      autoTable(doc, {
        startY: 45,
        head: [header],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`nota-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      setExportingPdf(false);
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
            <option value="failed">{t("export.statusFailed")}</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-ink-line/20 pt-6">
        <div className="text-sm">
          <span className="text-text-muted">{t("export.totalMatches")}: </span>
          <span className="font-bold text-text">{filtered.length}</span>
          <span className="mx-2 text-ink-line">|</span>
          <span className="text-text-muted">{t("export.totalAmount")}: </span>
          <span className="font-bold text-accent">{totalAmount.toFixed(2)} USDC</span>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={disabled || exportingCsv || exportingPdf || filtered.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-bg transition-all hover:opacity-90 disabled:opacity-50"
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            CSV
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={disabled || exportingCsv || exportingPdf || filtered.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-ink-line/40 bg-ink-2 px-6 py-2.5 text-sm font-semibold text-text transition-all hover:bg-ink-line/20 disabled:opacity-50"
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}
