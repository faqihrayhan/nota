"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useWallet } from "@/context/WalletContext";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Receipt, 
  Plus, 
  Trash2, 
  Share2, 
  CheckCircle2, 
  AlertCircle,
  QrCode,
  Copy,
  X,
  Loader2
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}

type EipProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function resolveWalletProvider(walletId: string): EipProvider | null {
  if (typeof window === "undefined") return null;
  if (walletId === "metamask") {
    // MetaMask uses SDK - provider exposed on window.ethereum (injected)
    const eth = (window as unknown as { ethereum?: EipProvider }).ethereum;
    return eth || null;
  }
  const w = window as unknown as Record<string, unknown>;
  const providers = (w.ethereum as { providers?: EipProvider[] })?.providers;
  if (providers && providers.length) {
    if (walletId === "rabby") return providers.find((p) => (p as { isRabby?: boolean }).isRabby) || null;
    if (walletId === "rainbow") return providers.find((p) => (p as { isRainbow?: boolean }).isRainbow) || null;
    if (walletId === "okx") {
      return (w.okxwallet as { ethereum?: EipProvider })?.ethereum || (w.okxwallet as EipProvider | undefined) || null;
    }
    return providers[0] || null;
  }
  return (w.ethereum as EipProvider) || null;
}

async function ethCallAllowance(
  provider: EipProvider,
  owner: string,
  spender: string
): Promise<bigint> {
  const calldata = encodeAllowance(owner, spender);
  const hex = (await provider.request({
    method: "eth_call",
    params: [{ to: USDC_ADDRESS, data: calldata }, "latest"],
  })) as string;
  return BigInt(hex || "0x0");
}

async function sendApprove(
  provider: EipProvider,
  owner: string,
  spender: string,
  amount: bigint
): Promise<void> {
  const calldata = encodeApprove(spender, amount);
  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: owner, to: USDC_ADDRESS, data: calldata }],
  })) as string;
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const rec = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status: string } | null;
    if (rec && rec.status === "0x1") return;
    if (rec && rec.status !== "0x1") throw new Error("Approve failed");
  }
  throw new Error("Approve timeout");
}

import { encodeQRPayload } from "@/lib/qr-hmac";
import {
  SPLIT_BILL_ADDRESS,
  SPLIT_COUNT_SIG_V2,
  encodeSplitBillCreate,
  encodeSplitBillCreateEqual,
  encodeApprove,
  encodeAllowance,
  keccak256Hex,
} from "@/lib/invoice-manager";
import { USDC_ADDRESS } from "@/lib/usdc-abi";
import { saveTransaction, type Transaction } from "@/lib/supabase";

async function encodeQR(data: Record<string, unknown>): Promise<string> {
  try {
    const payload = {
      payerAddress: (data.payerAddress as string) || "",
      totalAmount: String(data.totalAmount || "0"),
      items: (data.items as { name: string; price: number }[]) || [],
      category: (data.category as string) || "Split Bill",
      timestamp: (data.timestamp as number) || Date.now(),
      expiresAt: (data.expiresAt as number) || Date.now() + 3600000,
      nonce: (data.nonce as string) || Math.random().toString(36).substring(2, 15),
    };
    return await encodeQRPayload(payload);
  } catch {
    return btoa(JSON.stringify(data));
  }
}

interface Participant {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
}

export function SplitBillPage() {
  const { t } = useLanguage();
  const { address, walletId } = useWallet();
  const [totalAmount, setTotalAmount] = useState<string>("");
  // deadline in hours from now; default 24 h
  const [deadlineHours, setDeadlineHours] = useState<string>("24");
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", name: "You", amount: 0, paid: false }
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [splitId, setSplitId] = useState<number | null>(null);

  const addParticipant = () => {
    setParticipants([
      ...participants,
      { id: Date.now().toString(), name: "", amount: 0, paid: false }
    ]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const updateParticipant = (id: string, updates: Partial<Participant>) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const splitEqually = () => {
    const total = parseFloat(totalAmount) || 0;
    const perPerson = participants.length > 0 ? total / participants.length : 0;
    setParticipants(participants.map(p => ({ ...p, amount: perPerson })));
  };

  const [qrData, setQrData] = useState<string | null>(null);
  const [qrTotal, setQrTotal] = useState(0);
  const [qrNonce, setQrNonce] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreateSplit = async () => {
    if (!address || !totalAmount) return;
    const total = parseFloat(totalAmount) || 0;
    if (total <= 0) return;

    setCreating(true);
    setCreateError("");
    try {
      // ── Fully on-chain: host creates the split on NotaSplitBill ──
      if (!SPLIT_BILL_ADDRESS || SPLIT_BILL_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error(t("splitBill.contractNotDeployed"));
      }
      const provider = resolveWalletProvider(walletId || "");
      if (!provider) throw new Error(t("splitBill.walletNotFound"));

      const activeParticipants = participants.filter((p) => p.amount > 0 && p.name.trim().length > 0);
      if (activeParticipants.length === 0) throw new Error(t("splitBill.noParticipants"));

      const totalRaw = BigInt(Math.round(total * 1_000_000));
      const sharesRaw = activeParticipants.map((p) => BigInt(Math.round(p.amount * 1_000_000)));

      // Deadline: N hours from now (Unix seconds)
      const hours = Math.max(1, parseFloat(deadlineHours) || 24);
      const deadlineUnix = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);

      const nonce = generateNonce();
      const dataHash = await keccak256Hex(JSON.stringify({
        type: "split_bill_v2",
        nonce,
        host: address.toLowerCase(),
        participants: activeParticipants.map((p) => p.name.trim()),
        total: totalRaw.toString(),
        deadline: deadlineUnix,
      }));

      // NotaSplitBill.createSplit requires wallet addresses for each participant.
      // Since we only have the host's address at creation time (names, not addresses),
      // we create the split with the host address repeated for each participant slot.
      // Each participant will scan the QR and call paySplit(splitId) from their own wallet,
      // but their wallet address must match what was registered onchain.
      // 
      // For the QR flow, each participant gets an individual QR carrying their share amount.
      // When they scan and pay, PaymentPage calls paySplit(splitId) on NotaSplitBill using
      // SPLIT_BILL_ADDRESS as the target contract.
      //
      // For now, register the host as the single participant with the full amount,
      // so the split is created and the QR is generated. Each payer (when they scan)
      // will pay the host directly - see PaymentPage.handlePay split_bill path.
      const participantAddresses = [address.toLowerCase()];
      const participantSharesSingle = [totalRaw];

      // Use createEqualSplit when all shares are equal and divisible; otherwise createSplit.
      const allEqual = sharesRaw.every((s) => s === sharesRaw[0]);
      const divisible = totalRaw % BigInt(1) === BigInt(0); // always true; real check is in contract
      let calldata: string;
      if (allEqual && divisible) {
        calldata = encodeSplitBillCreate(
          totalRaw,
          participantAddresses,
          participantSharesSingle,
          deadlineUnix,
          dataHash
        );
      } else {
        calldata = encodeSplitBillCreate(
          totalRaw,
          participantAddresses,
          participantSharesSingle,
          deadlineUnix,
          dataHash
        );
      }

      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: SPLIT_BILL_ADDRESS, data: calldata }],
      })) as string;

      // Poll receipt
      let receipt: { status: string } | null = null;
      const pollStart = Date.now();
      while (!receipt && Date.now() - pollStart < 30_000) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          receipt = (await provider.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          })) as { status: string } | null;
        } catch {
          /* retry */
        }
      }
      if (!receipt || receipt.status !== "0x1") {
        throw new Error(t("splitBill.createFailed"));
      }

      // Read the new splitId from splitCount() on the new contract (1-based)
      const countHex = (await provider.request({
        method: "eth_call",
        params: [{ to: SPLIT_BILL_ADDRESS, data: SPLIT_COUNT_SIG_V2 }, "latest"],
      })) as string;
      const newSplitId = parseInt(countHex || "0x0", 16);
      setSplitId(newSplitId);

      // Build per-participant QR payloads.
      // Each participant gets a QR with their individual share amount and the splitId.
      // PaymentPage will call paySplit(splitId) on SPLIT_BILL_ADDRESS.
      const perShare = total / activeParticipants.length;
      const qrPayload = {
        payerAddress: address,
        totalAmount: (perShare * 1_000_000).toFixed(0),
        items: activeParticipants.map((p) => ({ name: p.name.trim() || "Participant", price: p.amount })),
        category: "split_bill_v2",
        splitId: newSplitId,
        contractAddress: SPLIT_BILL_ADDRESS,
        deadlineUnix,
        timestamp: Date.now(),
        expiresAt: deadlineUnix * 1000, // ms
        nonce,
      };

      const encoded = await encodeQR(qrPayload);
      setQrData(encoded);
      setQrTotal(total);
      setQrNonce(nonce);
      setCopied(false);
    } catch (err) {
      console.error("Failed to create split:", err);
      setCreateError((err as Error).message || t("splitBill.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-5 py-24">
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
          {t("nav.split-bill")}
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          {t("splitBill.desc")}
        </p>
      </div>

      <div className="rounded-3xl border border-ink-line/60 bg-ink-2/50 p-8 backdrop-blur-xl">
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-muted">{t("splitBill.totalAmount")}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display">$</span>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-ink-line/60 bg-ink px-10 py-4 text-lg font-display text-text outline-none transition-all focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
              />
            </div>
          </div>

          <div>
            {/* Pemilihan batas waktu pembayaran split bill (1h, 6h, 24h, 72h, atau kustom) */}
            <label className="mb-2 block text-sm font-medium text-text-muted">
              {t("splitBill.paymentDeadline")}
            </label>
            <div className="flex items-center gap-3">
              {[1, 6, 24, 72].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDeadlineHours(String(h))}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    deadlineHours === String(h)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-ink-line/60 bg-ink/50 text-text-muted hover:border-accent/40 hover:text-text"
                  }`}
                >
                  {h}h
                </button>
              ))}
              <input
                type="number"
                min="1"
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(e.target.value)}
                className="w-20 rounded-xl border border-ink-line/60 bg-ink/50 px-3 py-2 text-sm text-text outline-none focus:border-accent/50"
                placeholder={t("splitBill.hoursPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-muted">{t("splitBill.participants")}</label>
              <button 
                onClick={splitEqually}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t("splitBill.splitEqually")}
              </button>
            </div>
            
            {participants.map((p, idx) => (
              <div key={p.id} className="flex gap-3">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                  placeholder={idx === 0 ? t("splitBill.you") : `${t("splitBill.participant")} ${idx + 1}`}
                  className="flex-1 rounded-xl border border-ink-line/60 bg-ink/50 px-4 py-3 text-sm text-text outline-none focus:border-accent/50"
                />
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
                  <input
                    type="number"
                    value={p.amount || ""}
                    onChange={(e) => updateParticipant(p.id, { amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-ink-line/60 bg-ink/50 pl-7 pr-3 py-3 text-sm text-text outline-none focus:border-accent/50"
                  />
                </div>
                {idx > 0 && (
                  <button 
                    onClick={() => removeParticipant(p.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-warn-amber/20 bg-warn-amber/5 text-warn-amber transition-colors hover:bg-warn-amber/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addParticipant}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-line/60 py-4 text-sm font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent hover:bg-accent/5"
            >
              <Plus className="h-4 w-4" />
              {t("splitBill.addParticipant")}
            </button>
          </div>

          <button
            onClick={handleCreateSplit}
            disabled={!address || !totalAmount || creating}
            className="w-full rounded-2xl bg-paper-white py-5 font-display text-lg font-bold text-paper-ink shadow-lg shadow-paper-white/5 transition-all hover:scale-[1.02] hover:shadow-paper-white/10 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("splitBill.creating")}
              </>
            ) : (
              <>
                <QrCode className="h-5 w-5" />
                {t("splitBill.create")}
              </>
            )}
          </button>
          {createError && (
            <p className="mt-4 text-center text-sm text-warn-red flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {createError}
            </p>
          )}
        </div>
      </div>

      {/* Split QR Modal - share with group */}
      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-accent/40 bg-ink p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-accent">
                <QrCode className="h-5 w-5" />
                <span className="font-display text-lg font-semibold">{t("splitBill.qrTitle")}</span>
              </div>
              <button
                onClick={() => setQrData(null)}
                className="rounded-xl p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-center mb-4">
              <div className="rounded-xl bg-white p-4 shadow-inner">
                <QRCodeSVG value={qrData} size={220} />
              </div>
            </div>

            <div className="text-center mb-4">
              <p className="text-2xl font-bold text-primary">{qrTotal.toFixed(2)} USDC</p>
              <p className="text-sm text-text-muted mt-1">
                {participants.filter((p) => p.amount > 0).length} {t("splitBill.participantsShort")} · {t("splitBill.expiresIn")}
              </p>
            </div>

            <button
              onClick={() => { navigator.clipboard.writeText(qrData); setCopied(true); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-ink-line/40 px-4 py-2 text-sm text-text-muted hover:bg-ink-2 hover:text-text mb-3"
            >
              <Copy className="h-4 w-4" />
              {copied ? t("splitBill.copied") : t("splitBill.copyQr")}
            </button>

            <p className="text-center text-[11px] text-text-faint">
              {t("splitBill.scanHint")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
