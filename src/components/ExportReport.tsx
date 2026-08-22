"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { type Transaction } from "@/lib/supabase";
import { categoryLabelKey, getEffectiveCategory } from "@/lib/category-meta";
import { FileSpreadsheet, Download, Loader2, CheckCircle2, FileText } from "lucide-react";

type StatusFilter = "all" | "confirmed" | "failed";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatUSDC(amount: number): string {
  return amount.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toCsv(rows: (string | number)[][]) {
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

/** Build a human-readable items string: "Nasi Goreng ×2; Es Teh ×1" */
function formatItemsList(items: Transaction["items"]): string {
  if (!items || items.length === 0) return "";
  return items
    .map((i) => {
      const qty = i.qty && i.qty > 0 ? i.qty : 1;
      return qty > 1 ? `${i.name} ×${qty}` : i.name;
    })
    .join("; ");
}

/** Count total item quantity across all items in a transaction */
function totalItemQty(items: Transaction["items"]): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, i) => sum + (i.qty && i.qty > 0 ? i.qty : 1), 0);
}

export default function ExportReport({
  transactions,
  incoming,
  walletAddress,
  disabled,
}: {
  transactions: Transaction[];
  incoming: Transaction[];
  walletAddress: string;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [done, setDone] = useState(false);

  // Merge outflow + inflow, deduplicate by id, tag direction
  const allTxns = useMemo(() => {
    const seen = new Set<string>();
    const result: (Transaction & { direction: "inflow" | "outflow" })[] = [];

    for (const tx of transactions) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        const isOutflow = tx.payer_address.toLowerCase() === walletAddress.toLowerCase();
        result.push({ ...tx, direction: isOutflow ? "outflow" : "inflow" });
      }
    }
    for (const tx of incoming) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        result.push({ ...tx, direction: "inflow" });
      }
    }

    // Sort by date descending (newest first)
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [transactions, incoming, walletAddress]);

  const filtered = useMemo(() => {
    return allTxns.filter((tx) => {
      if (status !== "all" && tx.status !== status) return false;
      const ts = new Date(tx.created_at).getTime();
      if (fromDate && ts < new Date(`${fromDate}T00:00:00`).getTime()) return false;
      if (toDate && ts > new Date(`${toDate}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [allTxns, fromDate, toDate, status]);

  const totalInflow = useMemo(
    () => filtered.filter((tx) => tx.direction === "inflow").reduce((sum, tx) => sum + (tx.amount || 0), 0),
    [filtered]
  );
  const totalOutflow = useMemo(
    () => filtered.filter((tx) => tx.direction === "outflow").reduce((sum, tx) => sum + (tx.amount || 0), 0),
    [filtered]
  );
  const totalAmount = totalInflow + totalOutflow;

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    setExportingCsv(true);
    setDone(false);

    try {
      const header = [
        t("export.date"),
        t("export.direction"),
        t("export.category"),
        t("export.items"),
        t("export.qty"),
        t("export.amount"),
        t("export.status"),
        t("export.payer"),
        t("export.payee"),
        t("export.txHash"),
      ];

      const rows = filtered.map((tx) => [
        formatDateTime(tx.created_at),
        tx.direction === "inflow" ? t("export.directionInflow") : t("export.directionOutflow"),
        t(categoryLabelKey(getEffectiveCategory(tx, walletAddress))),
        formatItemsList(tx.items),
        totalItemQty(tx.items),
        tx.amount,
        tx.status,
        tx.payer_address,
        tx.payee_address,
        tx.tx_hash,
      ]);

      // SUM row
      const sumRow = [
        t("export.sumLabel"),
        "",
        "",
        "",
        "",
        totalAmount,
        "",
        "",
        "",
        "",
      ];

      // Inflow/Outflow breakdown
      const inflowRow = [
        `  ${t("export.directionInflow")}`,
        "",
        "",
        "",
        "",
        totalInflow,
        "",
        "",
        "",
        "",
      ];
      const outflowRow = [
        `  ${t("export.directionOutflow")}`,
        "",
        "",
        "",
        "",
        totalOutflow,
        "",
        "",
        "",
        "",
      ];

      const blob = new Blob(["\uFEFF" + toCsv([header, ...rows, [], sumRow, inflowRow, outflowRow])], {
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

      // ── Title ──
      doc.setFontSize(18);
      doc.text("Nota — Accounting Report", 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      // Summary section
      const summaryLines = [
        `${t("export.totalMatches")}: ${filtered.length} ${t("analisa.transactions").toLowerCase()}`,
        `${t("export.directionInflow")}: ${formatUSDC(totalInflow)} USDC`,
        `${t("export.directionOutflow")}: ${formatUSDC(totalOutflow)} USDC`,
        `${t("export.sumLabel")}: ${formatUSDC(totalAmount)} USDC`,
      ];
      let yPos = 38;
      for (const line of summaryLines) {
        doc.text(line, 14, yPos);
        yPos += 6;
      }

      // ── Table ──
      const header = [
        t("export.date"),
        t("export.direction"),
        t("export.category"),
        t("export.items"),
        t("export.qty"),
        t("export.amount"),
        t("export.status"),
      ];

      const rows = filtered.map((tx) => [
        formatDateTime(tx.created_at).split(",")[0],
        tx.direction === "inflow" ? t("export.directionInflow") : t("export.directionOutflow"),
        t(categoryLabelKey(getEffectiveCategory(tx, walletAddress))),
        formatItemsList(tx.items) || "-",
        totalItemQty(tx.items) || "-",
        `${formatUSDC(tx.amount)} USDC`,
        tx.status,
      ]);

      // SUM footer row
      const footerRow = [
        t("export.sumLabel"),
        "",
        "",
        "",
        "",
        `${formatUSDC(totalAmount)} USDC`,
        "",
      ];

      autoTable(doc, {
        startY: yPos + 4,
        head: [header],
        body: [...rows, footerRow],
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 28 }, // Date
          3: { cellWidth: 38 }, // Items
          5: { halign: "right" }, // Amount
        },
        didParseCell: (data) => {
          // Style the SUM footer row
          if (data.section === "body" && data.row.index === rows.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
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
        <div className="text-sm space-y-1">
          <div>
            <span className="text-text-muted">{t("export.totalMatches")}: </span>
            <span className="font-bold text-text">{filtered.length}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <span className="text-stamp-green text-xs">▲</span>{" "}
              <span className="text-text-muted">{t("export.directionInflow")}: </span>
              <span className="font-bold text-stamp-green">{formatUSDC(totalInflow)} USDC</span>
            </span>
            <span>
              <span className="text-warn-amber text-xs">▼</span>{" "}
              <span className="text-text-muted">{t("export.directionOutflow")}: </span>
              <span className="font-bold text-warn-amber">{formatUSDC(totalOutflow)} USDC</span>
            </span>
          </div>
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
