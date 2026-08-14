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
  X
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}

import { encodeQRPayload } from "@/lib/qr-hmac";

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
  const { address } = useWallet();
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", name: "You", amount: 0, paid: false }
  ]);

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

    // Build QR payload compatible with PaymentPage scanner (decodeQR).
    const nonce = generateNonce();
    const qrPayload = {
      payerAddress: address,
      totalAmount: (total * 1_000_000).toFixed(0),
      items: participants
        .filter((p) => p.amount > 0)
        .map((p) => ({ name: p.name.trim() || "Participant", price: p.amount })),
      category: "split",
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce,
    };

    const encoded = await encodeQR(qrPayload);
    setQrData(encoded);
    setQrTotal(total);
    setQrNonce(nonce);
    setCopied(false);
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
            disabled={!address || !totalAmount}
            className="w-full rounded-2xl bg-paper-white py-5 font-display text-lg font-bold text-paper-ink shadow-lg shadow-paper-white/5 transition-all hover:scale-[1.02] hover:shadow-paper-white/10 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            <QrCode className="h-5 w-5" />
            {t("splitBill.create")}
          </button>
        </div>
      </div>

      {/* Split QR Modal — share with group */}
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
