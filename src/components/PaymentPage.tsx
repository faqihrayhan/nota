"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import { USDC_ADDRESS } from "@/lib/usdc-abi";
import {
  saveTransaction,
  findTransactionByNonce,
  subscribeToTransactions,
  type Transaction,
} from "@/lib/supabase";
import { ARC_EXPLORER_URL } from "@/lib/arc-chain";
import { QRScanner } from "@/components/QRScanner";
import ReceiptModal from "@/components/ReceiptModal";
import { cn } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";
import {
  QrCode,
  Camera,
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  Wallet,
  FileText,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";


const CATEGORIES = [
  { id: "makan", icon: "🍽️" },
  { id: "transport", icon: "🚗" },
  { id: "belanja", icon: "🛒" },
  { id: "hiburan", icon: "🎬" },
  { id: "kesehatan", icon: "💊" },
  { id: "lainnya", icon: "📦" },
];

type QRData = {
  payerAddress: string;
  totalAmount: string;
  items: { name: string; price: number }[];
  category: string;
  timestamp: number;
  expiresAt: number;
  nonce: string;
};

type Tab = "bayar" | "terima";

function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}

function formatUSDC(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function encodeQR(data: QRData): string {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

function decodeQR(raw: string): QRData | null {
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

function encodeApprove(spender: string, amount: string): string {
  const fnSig = "0x095ea7b3";
  const paddedSpender = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedAmount = BigInt(amount).toString(16).padStart(64, "0");
  return fnSig + paddedSpender + paddedAmount;
}

function encodeTransferFrom(from: string, to: string, amount: string): string {
  const fnSig = "0x23b872dd";
  const paddedFrom = from.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedAmount = BigInt(amount).toString(16).padStart(64, "0");
  return fnSig + paddedFrom + paddedTo + paddedAmount;
}

export function PaymentPage() {
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
  const { address, isCorrectNetwork } = useWallet();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("bayar");

  const [items, setItems] = useState<{ name: string; price: string }[]>([
    { name: "", price: "" },
  ]);
  const [category, setCategory] = useState("makan");
  const [qrSvg, setQrSvg] = useState<string>("");
  const [qrRaw, setQrRaw] = useState<string>("");
  const [merchantPrefill, setMerchantPrefill] = useState<{ items: string; amount: string } | null>(null);

  // Read query params from /merchant (?source=merchant&items=...&amount=...)
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("source") !== "merchant") return;
    const itemsParam = searchParams.get("items") ?? "";
    const amountParam = searchParams.get("amount") ?? "";
    if (!itemsParam && !amountParam) return;
    setMerchantPrefill({ items: itemsParam, amount: amountParam });
    // Switch to create tab so cashier can review & generate QR directly.
    setTab("create");
    // Prefill items list by parsing "2x Item A, 1x Item B"
    if (itemsParam) {
      const parsed: PaymentItem[] = itemsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const m = s.match(/^(\d+)x\s+(.+)$/);
          const qty = m ? Math.max(1, parseInt(m[1], 10)) : 1;
          const name = (m ? m[2] : s).trim();
          // Split amount evenly across item rows; qty multiplier applied client-side by cashier.
          const perItem = amountParam && !isNaN(parseFloat(amountParam))
            ? (parseFloat(amountParam) / Math.max(1, itemsParam.split(",").length)).toFixed(2)
            : "0";
          feeOverrides,
          );
          receiptUrl = `${ARC_EXPLORER_URL}/tx/${hash}`;
          }

          // Finalize shared logic
          const finalizePayment = (txHash: string, blockNumber: number, merchantAmount: string, merchantWallet: string) => {
          setReceiptIds((prev) => [String(Date.now()), ...prev]);
          setSuccessTx(txHash);
          setScannedData(null);
          setScanInput("");
          };
  }, [searchParams]);
  const [paidTx, setPaidTx] = useState<Transaction | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveTx, setApproveTx] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [scanInput, setScanInput] = useState("");
  const [scannedData, setScannedData] = useState<QRData | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);

  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  const total = items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    return sum + price;
  }, 0);

  useEffect(() => {
    if (!qrData) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.floor((qrData.expiresAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        setQrData(null);
        setQrRaw("");
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [qrData]);

  // Selama QR sedang tampil (menunggu di-scan), cek berkala apakah sudah
  // ada transaksi dengan nonce yang sama di database. Kalau Supabase aktif,
  // ini juga dibantu channel realtime supaya update-nya nyaris instan
  // (tidak perlu nunggu jadwal polling berikutnya).
  useEffect(() => {
    if (!qrData) return;

    let cancelled = false;
    const nonce = qrData.nonce;

    async function checkPaid() {
      const found = await findTransactionByNonce(nonce);
      if (found && !cancelled) {
        setPaidTx(found);
        setQrData(null);
        setQrRaw("");
      }
    }

    checkPaid();
    const pollId = setInterval(checkPaid, 3000);
    const unsubscribe = subscribeToTransactions(checkPaid);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      unsubscribe();
    };
  }, [qrData]);

  const addItem = () => setItems((prev) => [...prev, { name: "", price: "" }]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: "name" | "price", value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleGenerateQR = async () => {
    setError("");
    if (!wallet.address) {
      setError(t("payment.error.connectWallet"));
      return;
    }
    if (total <= 0) {
      setError(t("payment.error.minAmount"));
      return;
    }

    const validItems = items.filter((i) => i.name.trim() && parseFloat(i.price) > 0);
    if (validItems.length === 0) {
      setError(t("payment.error.noItems"));
      return;
    }

    const amountInUnits = Math.floor(total * 1_000_000).toString();

    setApproving(true);
    try {
      const provider = resolveProvider(wallet.walletId!);
      if (!provider) throw new Error("Provider not found");

      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet.address,
          to: USDC_ADDRESS,
          data: encodeApprove(wallet.address, amountInUnits),
        }],
      })) as string;

      setApproveTx(txHash);
      await new Promise((r) => setTimeout(r, 3000));

      const data: QRData = {
        payerAddress: wallet.address,
        totalAmount: amountInUnits,
        items: validItems.map((i) => ({ name: i.name, price: parseFloat(i.price) })),
        category,
        timestamp: Date.now(),
        expiresAt: Date.now() + 3 * 60 * 1000,
        nonce: generateNonce(),
      };

      const raw = encodeQR(data);
      setQrData(data);
      setQrRaw(raw);
    } catch (err) {
      setError((err as Error).message || t("payment.error.approveFailed"));
    } finally {
      setApproving(false);
    }
  };

  const handleScan = () => {
    setError("");
    const data = decodeQR(scanInput.trim());
    if (!data) {
      setError(t("payment.error.invalidQR"));
      return;
    }
    if (Date.now() > data.expiresAt) {
      setError(t("payment.error.qrExpired"));
      return;
    }
    setScannedData(data);
  };

// Perbaikan fungsi handleTransferFrom di src/components/PaymentPage.tsx sesuai docs.arc.io:
const confirmTransfer = async () => {
  if (!scannedData || !wallet.address) return;
  setError("");
  setTransferring(true);

  try {
    const provider = resolveProvider(wallet.walletId!);
    if (!provider) throw new Error("Provider wallet tidak ditemukan");

    const payeeAddress = scannedData.payerAddress.toLowerCase(); // Alamat Penerima

    // Konversi jumlah dari QR (USDC) ke 18 Decimals (Wei) Native Arc USDC
    // Misal: 1.00 USDC -> 1_000_000_000_000_000_000 Wei (10^18)
    const amountInUsdc = parseFloat(scannedData.totalAmount) / 1_000_000;
    const valueInWeiHex = "0x" + BigInt(Math.floor(amountInUsdc * 1e18)).toString(16);

    // Kirim Native Transfer USDC langsung di Arc Chain
    const txHash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: wallet.address,
          to: payeeAddress,
          value: valueInWeiHex, // Value Native USDC 18 decimals
        },
      ],
    })) as string;

    // Tunggu receipt On-Chain dari Arc Testnet
    await new Promise((r) => setTimeout(r, 4000));

    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { blockHash: string; blockNumber: string; status: string } | null;

    const isSuccess = receipt?.status === "0x1";

    if (!isSuccess) {
      throw new Error("Transaksi gagal di-mining On-Chain. Pastikan saldo USDC di wallet mencukupi!");
    }

    const tx: Transaction = {
      id: generateNonce(),
      payer_address: wallet.address.toLowerCase(),
      payee_address: payeeAddress,
      amount: amountInUsdc,
      category: scannedData.category,
      items: scannedData.items,
      tx_hash: txHash,
      block_hash: receipt?.blockHash || "",
      block_number: receipt ? parseInt(receipt.blockNumber, 16) : 0,
      status: "confirmed",
      mode: "receive",
      created_at: new Date().toISOString(),
      nonce: scannedData.nonce,
    };

    await saveTransaction(tx);
    setSuccessTx(tx);
    setScannedData(null);
    setScanInput("");
  } catch (err) {
    setError((err as Error).message || t("payment.error.transferFailed"));
  } finally {
    setTransferring(false);
  }
};



  const copyQR = () => {
    if (qrRaw) navigator.clipboard.writeText(qrRaw);
  };

  // Referensi function ini HARUS stabil (tidak dibuat ulang tiap render).
  // Kalau tidak, useEffect di QRScanner (yang dependency-nya [onScan])
  // akan mengira propnya berubah tiap kali timer `timeLeft` tick,
  // lalu mematikan & menyalakan ulang kamera tiap detik — akibatnya
  // kamera tidak pernah sempat mendeteksi QR code.
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

  if (!wallet.address) {
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
      {merchantItems.length > 0 && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-primary">
            <ShoppingBag size={18} />
            <p className="text-sm font-bold">{t("merchant.prefillReady")}</p>
          </div>
          <ul className="mt-3 space-y-1">
            {merchantItems.map((mi) => (
              <li key={mi.id} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                  {mi.qty}× {mi.name}
                </span>
                <span className="font-mono font-bold text-primary">
                  ${ (mi.price * mi.qty).toFixed(2) }
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-primary/20 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{t("merchant.subtotal")}</span>
            <span className="text-sm font-black text-primary">${totalMerchantUSDC.toFixed(2)} USDC</span>
          </div>
          <p className="mt-2 text-[10px] text-text-muted">{t("merchant.prefillHint")}</p>
        </div>
      )}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <Receipt className="h-3 w-3" />
          {t("payment.eyebrow")}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{t("payment.title")}</h1>
        <p className="mt-2 text-text-muted">{t("payment.desc")}</p>
      </div>

      {posPrefill && (
        <div className="mb-6 rounded-2xl border border-arc/40 bg-arc/10 p-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-arc" />
                <p className="text-xs font-bold uppercase tracking-widest text-arc">
                  {t("payment.posBadge")}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold text-text">{t("payment.posTitle")}</p>
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {posPrefill.items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="inline-block h-1 w-1 rounded-full bg-arc" />
                    {item.qty}x {item.name}
                  </li>
                ))}
              </ul>
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-arc/40 bg-arc/20 px-3 py-1.5 font-mono text-sm font-bold text-arc">
                {posPrefill.totalUSDC.toFixed(2)} USDC
              </p>
              <p className="mt-2 text-[11px] text-text-muted">{t("payment.posHint")}</p>
            </div>
            <button
              onClick={clearPosPrefill}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-ink-line/40 hover:text-text"
              aria-label={t("payment.posDismiss")}
              title={t("payment.posDismiss")}
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex rounded-xl border border-ink-line/40 bg-ink-2/30 p-1">
        {(["bayar", "terima"] as Tab[]).map((tKey) => (
          <button
            key={tKey}
            onClick={() => {
              setTab(tKey);
              setError("");
              setSuccessTx(null);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-300",
              tab === tKey
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-text-muted hover:text-text"
            )}
          >
            {tKey === "bayar" ? <QrCode className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {t(`payment.tab.${tKey}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-warn-amber/40 bg-warn-amber/10 px-4 py-3 text-sm text-warn-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {tab === "bayar" && (
        <div className="mt-6 space-y-6">
          {paidTx ? (
            <div className="rounded-2xl border border-stamp-green/40 bg-stamp-green/5 p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-stamp-green" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {t("payment.paidSuccess")}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {formatUSDC(paidTx.amount)} USDC
              </p>
              <a
                href={`${ARC_EXPLORER_URL}/tx/${paidTx.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-strong transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {t("payment.viewApprove")}
              </a>
              <div>
                <button
                  onClick={() => setPaidTx(null)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-strong transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  {t("payment.newTransaction")}
                </button>
              </div>
            </div>
          ) : !qrData ? (
            <>
              <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
                <h3 className="font-display text-sm font-semibold">{t("payment.items")}</h3>
                <div className="mt-4 space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder={t("payment.itemName")}
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        className="flex-1 rounded-lg border border-ink-line/50 bg-ink-2 px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
                      />
                      <input
                        type="number"
                        placeholder="0"
                        value={item.price}
                        onChange={(e) => updateItem(idx, "price", e.target.value)}
                        className="w-28 rounded-lg border border-ink-line/50 bg-ink-2 px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
                      />
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-line/40 text-text-muted hover:text-warn-amber hover:border-warn-amber/40 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t("payment.addItem")}
                </button>

                <div className="mt-4 border-t border-ink-line/30 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">{t("payment.total")}</span>
                    <span className="font-display text-xl font-semibold">{formatUSDC(total)} USDC</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
                <h3 className="font-display text-sm font-semibold">{t("payment.category")}</h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all duration-200",
                        category === cat.id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-ink-line/40 bg-ink-2 text-text-muted hover:border-ink-line hover:text-text"
                      )}
                    >
                      <span>{cat.icon}</span>
                      <span className="capitalize">{t(`payment.cat.${cat.id}`)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateQR}
                disabled={approving || total <= 0}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-medium text-white transition-all duration-300",
                  "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {approving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("payment.approving")}
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    {t("payment.generateQR")}
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-8 text-center">
              <div className="mx-auto w-full max-w-xs">
                  <div className="relative mx-auto aspect-square w-full max-w-[280px] rounded-xl bg-white p-4 flex items-center justify-center">
                    <QRCodeSVG
                      value={qrRaw}
                      size={240}
                      bgColor={"#FFFFFF"}
                      fgColor={"#000000"}
                      level={"M"}
                      includeMargin={false}
                     />
                    </div>


                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
                  <Clock className="h-4 w-4" />
                  <span>
                    {t("payment.expiresIn")}{" "}
                    <span className={cn("font-mono font-medium", timeLeft < 30 && "text-warn-amber")}>
                      {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                    </span>
                  </span>
                </div>

                <button
                  onClick={copyQR}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {t("payment.copyQR")}
                </button>

                <div className="mt-6 rounded-xl border border-ink-line/30 bg-ink-2/50 p-4 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">{t("payment.total")}</span>
                    <span className="font-medium">{formatUSDC(parseInt(qrData.totalAmount) / 1_000_000)} USDC</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-text-muted">{t("payment.category")}</span>
                    <span className="font-medium capitalize">{t(`payment.cat.${qrData.category}`)}</span>
                  </div>
                  {approveTx && (
                    <a
                      href={`${ARC_EXPLORER_URL}/tx/${approveTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:text-accent-strong transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("payment.viewApprove")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "terima" && (
        <div className="mt-6 space-y-6">
          {!scannedData && !successTx ? (
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <h3 className="font-display text-sm font-semibold">{t("payment.scanQR")}</h3>
              <p className="mt-1 text-xs text-text-muted">{t("payment.scanDesc")}</p>

              <button
                onClick={() => setCameraOpen(true)}
                className={cn(
                  "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-line/50 bg-ink-2 px-6 py-3 text-sm font-medium text-text transition-all duration-300",
                  "hover:border-accent/50 hover:bg-ink-3 hover:text-accent"
                )}
              >
                <Camera className="h-4 w-4" />
                {t("payment.openCamera")}
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-line/30" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-text-faint">{t("payment.or")}</span>
                <div className="h-px flex-1 bg-ink-line/30" />
              </div>

              <textarea
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder={t("payment.scanPlaceholder")}
                rows={4}
                className="w-full rounded-lg border border-ink-line/50 bg-ink-2 px-4 py-3 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors resize-none font-mono"
              />
              <button
                onClick={handleScan}
                disabled={!scanInput.trim()}
                className={cn(
                  "mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-medium text-white transition-all duration-300",
                  "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                <Camera className="h-4 w-4" />
                {t("payment.scanButton")}
              </button>
            </div>
          ) : scannedData && !successTx ? (
            <div className="rounded-2xl border border-ink-line/40 bg-ink p-6">
              <h3 className="font-display text-sm font-semibold">{t("payment.confirmTitle")}</h3>

              <div className="mt-4 space-y-3 rounded-xl border border-ink-line/30 bg-ink-2/50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("payment.from")}</span>
                  <span className="font-mono text-xs">{scannedData.payerAddress.slice(0, 8)}…{scannedData.payerAddress.slice(-6)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("payment.total")}</span>
                  <span className="font-display text-lg font-semibold text-accent">
                    {formatUSDC(parseInt(scannedData.totalAmount) / 1_000_000)} USDC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("payment.category")}</span>
                  <span className="capitalize">{t(`payment.cat.${scannedData.category}`)}</span>
                </div>
                <div className="border-t border-ink-line/20 pt-3">
                  <p className="text-xs text-text-muted mb-2">{t("payment.items")}</p>
                  {scannedData.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-text-muted">{item.name}</span>
                      <span>{formatUSDC(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setScannedData(null); setScanInput(""); }}
                  className="flex-1 rounded-xl border border-ink-line/40 px-4 py-3 text-sm text-text-muted hover:text-text hover:bg-ink-2 transition-all"
                >
                  {t("payment.cancel")}
                </button>
                <button
                  onClick={handleTransferFrom}
                  disabled={transferring}
                  className={cn(
                    "flex flex-[2] items-center justify-center gap-2 rounded-xl bg-stamp-green px-4 py-3 text-sm font-medium text-white transition-all duration-300",
                    "hover:bg-stamp-green/90 hover:shadow-lg hover:shadow-stamp-green/20",
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
                      {t("payment.confirmReceive")}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : successTx ? (
            <div className="rounded-2xl border border-stamp-green/30 bg-stamp-green/5 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stamp-green/15">
                <CheckCircle2 className="h-8 w-8 text-stamp-green" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{t("payment.successTitle")}</h3>
              <p className="mt-1 text-sm text-text-muted">{t("payment.successDesc")}</p>

              <div className="mt-6 space-y-2 rounded-xl border border-ink-line/30 bg-ink p-4 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("payment.amount")}</span>
                  <span className="font-medium">{formatUSDC(successTx.amount)} USDC</span>
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
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("payment.blockHash")}</span>
                  <span className="font-mono text-xs text-text-faint">
                    {successTx.block_hash ? `${successTx.block_hash.slice(0, 10)}…` : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("payment.blockNumber")}</span>
                  <span className="font-mono text-xs">{successTx.block_number}</span>
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
                  <Receipt className="h-4 w-4" />
                  {t("payment.newTransaction")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {cameraOpen && (
        <QRScanner onScan={handleQRDetected} onClose={closeCamera} />
      )}
      <ReceiptModal tx={receiptTx} onClose={() => setReceiptTx(null)} />
    </section>
  );
}

function resolveProvider(id: string) {
  if (typeof window === "undefined") return undefined;
  if (id === "okx") {
    return (window as any).okxwallet?.ethereum ?? (window as any).okxwallet;
  }
  const eth = (window as any).ethereum;
  if (!eth) return undefined;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p: any) => p.isMetaMask);
  }
  return eth.isMetaMask ? eth : undefined;
}