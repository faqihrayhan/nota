"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  INVOICE_MANAGER_ADDRESS,
  encodeCreateAndPayInvoice,
  encodeApprove,
  encodeAllowance,
  keccak256Hex,
} from "@/lib/invoice-manager";
import { USDC_ADDRESS } from "@/lib/usdc-abi";
import {
  saveTransaction,
  findTransactionByNonce,
  subscribeToTransactions,
  getTransactions,
  deductStockAfterPayment,
  type Transaction,
} from "@/lib/supabase";
import { ARC_EXPLORER_URL } from "@/lib/arc-chain";
import { type CurrencyCode, CURRENCY_SYMBOLS, fetchLiveRates, convertFromUsdc, formatCurrency } from "@/lib/exchange-rate";
import { QRScanner } from "@/components/QRScanner";
import ReceiptModal from "@/components/ReceiptModal";
import { cn } from "@/lib/utils";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Wallet,
  FileText,
  ScanLine,
  History,
  Copy,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}

function formatUSDC(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function decodeQR(raw: string): { payerAddress: string; totalAmount: string; items: { name: string; price: number }[]; category: string; timestamp: number; expiresAt: number; nonce: string } | null {
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

function resolveProvider(walletId: string) {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const providers = (w.ethereum as { providers?: Record<string, unknown>[] })?.providers;
  if (providers) {
    const found = providers.find((p) => (p as { isMetaMask?: boolean }).isMetaMask);
    if (found) return found as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
  return (w.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }) || null;
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <section className="relative mx-auto max-w-2xl px-5 py-12">
          <div className="flex items-center justify-center gap-2 text-text-muted text-sm py-24">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        </section>
      }
    >
      <PaymentPageInner />
    </Suspense>
  );
}

function PaymentPageInner() {
  const wallet = useWallet();
  const { address } = wallet;
  const { t } = useLanguage();

  const [scanInput, setScanInput] = useState("");
  const [scannedData, setScannedData] = useState<ReturnType<typeof decodeQR>>(null);
  const [transferring, setTransferring] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<CurrencyCode>("USDC");
  const [allRates, setAllRates] = useState<Record<string, number>>({});

  // Load transaction history when wallet connects
  useEffect(() => {
    fetchLiveRates().then((r) => setAllRates(r.rates));
    if (!address) return;
    loadHistory();
const unsub = subscribeToTransactions(() => loadHistory());
    return () => unsub();
  }, [address]);

  const toggleCurrency = () => {
    const sequence: CurrencyCode[] = ["USDC", "IDR", "MYR", "SGD"];
    setCurrencyMode((m) => {
      const idx = sequence.indexOf(m);
      return sequence[(idx + 1) % sequence.length];
    });
  };

  async function loadHistory() {
    if (!address) return;
    try {
      const txs = await getTransactions(address);
      setHistory(txs);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  const handleScan = useCallback(() => {
    if (!scanInput.trim()) return;
    try {
      const decoded = decodeQR(scanInput.trim());
      if (decoded && Date.now() <= decoded.expiresAt) {
        setScannedData(decoded);
        setError("");
      } else if (decoded) {
        setError(t("payment.error.qrExpired"));
      } else {
        setError(t("payment.error.invalidQR"));
      }
    } catch {
      setError(t("payment.error.invalidQR"));
    }
  }, [scanInput, t]);

  const handleQRDetected = useCallback(
    (data: string) => {
      setScanInput(data);
      setCameraOpen(false);
      setTimeout(() => {
        try {
          const decoded = decodeQR(data.trim());
          if (decoded && Date.now() <= decoded.expiresAt) {
            setScannedData(decoded);
            setError("");
          } else if (decoded) {
            setError(t("payment.error.qrExpired"));
          } else {
            setError(t("payment.error.invalidQR"));
          }
        } catch {
          setError(t("payment.error.invalidQR"));
        }
      }, 100);
    },
    [t]
  );

  const closeCamera = useCallback(() => setCameraOpen(false), []);

  async function getAllowance(provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }, owner: string, spender: string): Promise<bigint> {
    const calldata = encodeAllowance(owner, spender);
    const hex = (await provider.request({
      method: "eth_call",
      params: [{ from: owner, to: USDC_ADDRESS, data: calldata }, "latest"],
    })) as string;
    return BigInt(hex || "0x0");
  }

  async function ensureAllowance(provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }, owner: string, spender: string, needed: bigint): Promise<void> {
    const current = await getAllowance(provider, owner, spender);
    if (current >= needed) return;
    const calldata = encodeApprove(spender, needed);
    const approveTx = (await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: owner, to: USDC_ADDRESS, data: calldata }],
    })) as string;
    // Wait for approve receipt
    const approveStart = Date.now();
    while (Date.now() - approveStart < 30_000) {
      await new Promise((r) => setTimeout(r, 2000));
      const rec = (await provider.request({
        method: "eth_getTransactionReceipt",
        params: [approveTx],
      })) as { status: string } | null;
      if (rec && rec.status === "0x1") return;
      if (rec && rec.status !== "0x1") throw new Error("Approve failed");
    }
    throw new Error("Approve timeout");
  }

  async function handlePay() {
    if (!address || !scannedData) return;
    if (!INVOICE_MANAGER_ADDRESS || INVOICE_MANAGER_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setError(t("payment.error.contractNotDeployed"));
      return;
    }
    const provider = resolveProvider(wallet.walletId || "");
    if (!provider) {
      setError(t("payment.error.walletNotFound"));
      return;
    }
    setTransferring(true);
    setError("");
    try {
      const amountInUsdc = parseFloat(scannedData.totalAmount) / 1_000_000;
      const payeeAddress = scannedData.payerAddress.toLowerCase();
      const amountInUnits = BigInt(Math.floor(amountInUsdc * 1_000_000));

      // dataHash = keccak256 of canonical JSON (nonce + payer + payee + amount)
      // → verifiable accounting: anyone can recompute & verify on-chain
      const dataHash = await keccak256Hex(JSON.stringify({
        nonce: scannedData.nonce,
        payer: address.toLowerCase(),
        payee: payeeAddress,
        amount: amountInUnits.toString(),
      }));

      // 1. Approve USDC to invoice manager if needed
      await ensureAllowance(provider, address, INVOICE_MANAGER_ADDRESS, amountInUnits);

      // 2. One-shot: create invoice + pay via contract (verifiable on-chain)
      const calldata = encodeCreateAndPayInvoice(payeeAddress, amountInUnits, dataHash);

      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: INVOICE_MANAGER_ADDRESS, data: calldata }],
      })) as string;

      // Poll for receipt (instead of fixed 4s sleep): check every 2s, up to 30s.
      let receipt: { blockHash: string; blockNumber: string; status: string } | null = null;
      const pollStart = Date.now();
      while (!receipt && Date.now() - pollStart < 30_000) {
        await new Promise((r) => setTimeout(r, 2000));
        receipt = (await provider.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        })) as { blockHash: string; blockNumber: string; status: string } | null;
      }

      const isSuccess = receipt?.status === "0x1";
      if (!isSuccess) {
        throw new Error(t("payment.error.transferFailed"));
      }

      const tx: Omit<Transaction, "id" | "created_at"> = {
        wallet_address: address.toLowerCase(),
        payer_address: address.toLowerCase(),
        payee_address: payeeAddress,
        amount: amountInUsdc,
        category: scannedData.category,
        items: scannedData.items,
        tx_hash: txHash,
        block_hash: receipt?.blockHash ?? "",
        block_number: receipt ? parseInt(receipt.blockNumber, 16) : 0,
        status: "confirmed",
        mode: "payment",
        nonce: scannedData.nonce,
      };

      await saveTransaction(tx);
      try {
        await deductStockAfterPayment(payeeAddress, scannedData.items);
      } catch (stockErr) {
        console.error("Failed to deduct stock:", stockErr);
      }
      await loadHistory();
      setSuccessTx(tx as Transaction);
      setScannedData(null);
      setScanInput("");
    } catch (err) {
      setError((err as Error).message || t("payment.error.transferFailed"));
    } finally {
      setTransferring(false);
    }
  }

  if (!address) {
    return (
      <section className="relative mx-auto max-w-2xl px-5 py-24">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line/40 bg-ink-2/30 p-12 text-center">
          <Wallet className="h-12 w-12 text-text-muted" />
          <h2 className="mt-4 font-display text-xl font-semibold">{t("payment.connectFirst")}</h2>
          <p className="mt-2 text-sm text-text-muted">{t("payment.connectDesc")}</p>
        </div>
      </section>
    );
  }

  return (
<section className="relative mx-auto max-w-2xl px-5 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <ScanLine className="h-3 w-3" />
          {t("payment.eyebrow")}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Scan & Pay</h1>
        <p className="mt-2 text-text-muted">Scan a QR code to complete your payment on-chain.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-warn-amber/40 bg-warn-amber/10 px-4 py-3 text-sm text-warn-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Scanned QR confirmation */}
      {scannedData ? (
        <div className="rounded-2xl border border-accent/40 bg-ink-2/30 p-6">
          <div className="flex items-center gap-2 text-accent">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-display text-lg font-semibold">{t("payment.confirmTitle")}</h3>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">{t("payment.from")}</span>
              <span className="font-mono text-xs">{scannedData.payerAddress.slice(0, 10)}…{scannedData.payerAddress.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{t("payment.total")}</span>
              <span className="font-medium">{formatUSDC(parseFloat(scannedData.totalAmount) / 1_000_000)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{t("payment.category")}</span>
              <span className="capitalize">{scannedData.category}</span>
            </div>
            {scannedData.items.length > 0 && (
              <div className="mt-3 rounded-xl border border-ink-line/30 bg-ink p-3">
                <p className="text-xs text-text-muted mb-2">{t("payment.items")}</p>
                {scannedData.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-text-muted">{item.name}</span>
                    <span>{formatUSDC(item.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => { setScannedData(null); setScanInput(""); }}
              className="flex-1 rounded-xl border border-ink-line/40 px-4 py-3 text-sm text-text-muted hover:text-text hover:bg-ink-2 transition-all"
            >
              {t("payment.cancel")}
            </button>
            <button
              onClick={handlePay}
              disabled={transferring}
              className={cn(
                "flex flex-[2] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-all",
                "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {transferring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("payment.processing")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t("payment.confirmPay")}
                </>
              )}
            </button>
          </div>
        </div>
      ) : successTx ? (
        /* Success state */
        <div className="rounded-2xl border border-stamp-green/40 bg-stamp-green/5 p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-stamp-green" />
<h3 className="mt-4 font-display text-lg font-semibold">{t("payment.successTitle")}</h3>
          <p className="mt-1 text-sm text-text-muted">{t("payment.successDesc")}</p>
          <div className="mt-6 space-y-2 rounded-xl border border-ink-line/30 bg-ink p-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("payment.amount")}</span>
              <span className="font-medium">{formatCurrency(convertFromUsdc(successTx.amount, currencyMode, allRates), currencyMode)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("payment.txHash")}</span>
              <a
                href={`${ARC_EXPLORER_URL}/tx/${successTx.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-accent hover:text-accent-strong transition-colors"
              >
                {successTx.tx_hash.slice(0, 10)}…{successTx.tx_hash.slice(-8)}
              </a>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setReceiptTx(successTx)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-strong transition-all"
            >
              <FileText className="h-4 w-4" />
              {t("payment.viewReceipt")}
            </button>
            <button
              onClick={() => { setSuccessTx(null); setScannedData(null); setScanInput(""); }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-ink-line/40 px-6 py-3 text-sm text-text-muted hover:text-text hover:bg-ink-2 transition-all"
            >
              <ScanLine className="h-4 w-4" />
              {t("payment.scanAnother")}
            </button>
          </div>
        </div>
      ) : (
        /* Scan QR section — rectangle card, camera-first (mobile-first) */
        <div className="rounded-2xl border border-ink-line/40 bg-ink-2/30 p-6">
          <div className="flex items-center gap-2 text-accent">
            <ScanLine className="h-5 w-5" />
            <h3 className="font-display text-sm font-semibold">Scan QR Code</h3>
          </div>
          <p className="mt-1 text-xs text-text-muted">Point your camera at a payment QR code, or paste the QR data below.</p>

          {/* Camera / scan area — rectangle block */}
          <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-line/50 bg-ink/40 px-4 py-10">
            <Camera className="h-8 w-8 text-accent" />
            <button
              onClick={() => setCameraOpen(true)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-6 py-3 text-sm font-medium text-accent transition-all",
                "hover:bg-accent/20 hover:shadow-lg hover:shadow-accent/10"
              )}
            >
              <Camera className="h-4 w-4" />
              {t("payment.openCamera")}
            </button>
            <span className="text-[11px] font-mono uppercase tracking-widest text-text-faint">{t("payment.or")}</span>
            <div className="flex w-full max-w-md flex-col gap-2.5">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder={t("payment.scanPlaceholder")}
                className="w-full rounded-xl border border-ink-line/40 bg-ink px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={handleScan}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-all",
                  "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20 active:scale-[0.99]"
                )}
              >
                <ScanLine className="h-4 w-4" />
                {t("payment.scanButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      {history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-text-muted" />
<h3 className="font-display text-sm font-semibold">{t("payment.history")}</h3>
          </div>
          <div className="space-y-2">
            {history.map((tx) => (
              <div
                key={tx.id}
                onClick={() => setReceiptTx(tx)}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-line/30 bg-ink p-4 transition-all hover:border-ink-line/60 hover:bg-ink-2"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{tx.category}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(tx.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(convertFromUsdc(tx.amount, currencyMode, allRates), currencyMode)}</p>
                  <p className={cn(
                    "text-xs capitalize",
                    tx.status === "confirmed" ? "text-stamp-green" : tx.status === "failed" ? "text-warn-amber" : "text-text-muted"
                  )}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera scanner modal */}
      {cameraOpen && <QRScanner onScan={handleQRDetected} onClose={closeCamera} />}

      {/* Receipt modal */}
      <ReceiptModal tx={receiptTx} onClose={() => setReceiptTx(null)} />
    </section>
  );
}
