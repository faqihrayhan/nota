"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { Transaction } from "@/lib/supabase";
import { ARC_EXPLORER_URL } from "@/lib/arc-chain";
import { cn } from "@/lib/utils";
import {
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

function formatDate(iso: string): string {
  // Always English (en-US) format for official digital receipt
  return new Date(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatUSDC(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function maskAddress(addr: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function maskTxHash(hash: string): string {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

/**
 * Digital Receipt Modal — 100% English content for official export (PDF/PNG).
 */
export default function ReceiptModal({
  tx,
  onClose,
}: {
  tx: Transaction | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);
  const [done, setDone] = useState<"pdf" | "png" | null>(null);

  if (!tx) return null;

  const isPayer = tx.mode === "payment";
  const directionLabel = isPayer ? "From" : "To";
  const counterAddress = isPayer ? tx.payee_address : tx.payer_address;
  const amountSign = isPayer ? "-" : "+";

  const downloadPdf = async () => {
    setExporting("pdf");
    try {
      const node = document.getElementById("receipt-print-area");
      if (!node) throw new Error("receipt node not found");
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
      const imgW = 148;
      const imgH = (node.offsetHeight / node.offsetWidth) * imgW;
      pdf.addImage(dataUrl, "PNG", 0, 0, imgW, imgH);
      pdf.save(`nota-receipt-${tx.tx_hash.slice(0, 10) || tx.id}.pdf`);
      setDone("pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  const downloadPng = async () => {
    setExporting("png");
    try {
      const node = document.getElementById("receipt-print-area");
      if (!node) throw new Error("receipt node not found");
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `nota-receipt-${tx.tx_hash.slice(0, 10) || tx.id}.png`;
      link.href = dataUrl;
      link.click();
      setDone("png");
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Digital Receipt"
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-line/40 bg-ink p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Digital Receipt</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-line/40 text-text-muted transition-all hover:text-text hover:bg-ink-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ===== Print Area (Captured to PDF/PNG) — 100% English ===== */}
        <div
          id="receipt-print-area"
          className="rounded-xl border border-ink-line/40 bg-white p-5 text-black"
          style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                Nota · Arc Testnet
              </p>
              <p className="mt-1 font-display text-lg font-bold tracking-tight">NOTA</p>
            </div>
            <div className="rounded-md border-2 border-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              {tx.status === "confirmed" ? "PAID" : tx.status.toUpperCase()}
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-dashed border-neutral-300 pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">Amount</span>
              <span className="font-bold">
                {amountSign} {formatUSDC(tx.amount)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Date</span>
              <span>{formatDate(tx.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Category</span>
              <span className="capitalize">{tx.category || "Others"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-neutral-500">{directionLabel}</span>
              <span className="break-all text-right font-mono">{maskAddress(counterAddress)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-neutral-500">Tx Hash</span>
              <span className="break-all text-right font-mono">{maskTxHash(tx.tx_hash)}</span>
            </div>
          </div>

          {tx.items && tx.items.length > 0 && (
            <div className="mt-4 border-t border-dashed border-neutral-300 pt-3 text-xs">
              <p className="mb-1.5 font-semibold uppercase tracking-wider text-neutral-400">
                Items
              </p>
              <div className="space-y-1">
                {tx.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="font-mono">{formatUSDC(item.price)} USDC</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 border-t-2 border-dashed border-neutral-300 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">Total</span>
              <span className="font-display text-lg font-bold">
                {amountSign} {formatUSDC(tx.amount)} USDC
              </span>
            </div>
          </div>

          <p className="mt-4 border-t border-dashed border-neutral-300 pt-3 text-center text-[9px] uppercase tracking-[0.25em] text-neutral-400">
            Recorded On-Chain · Arc Testnet
          </p>
        </div>
        {/* ===== End print area ===== */}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={downloadPdf}
            disabled={exporting !== null}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-ink-line/50 bg-ink-2 px-4 py-3 text-sm font-medium text-text transition-all",
              "hover:border-accent/50 hover:text-accent",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done === "pdf" ? (
              <CheckCircle2 className="h-4 w-4 text-stamp-green" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Download PDF
          </button>
          <button
            onClick={downloadPng}
            disabled={exporting !== null}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-ink-line/50 bg-ink-2 px-4 py-3 text-sm font-medium text-text transition-all",
              "hover:border-accent/50 hover:text-accent",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {exporting === "png" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done === "png" ? (
              <CheckCircle2 className="h-4 w-4 text-stamp-green" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            Download PNG
          </button>
        </div>

        <a
          href={`${ARC_EXPLORER_URL}/tx/${tx.tx_hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-accent hover:text-accent-strong transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View on ArcScan
        </a>
      </div>
    </div>
  );
}
