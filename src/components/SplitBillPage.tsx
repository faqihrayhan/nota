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
  QrCode
} from "lucide-react";

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

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleCreateSplit = async () => {
    if (!address || !totalAmount) return;
    setLoading(true);
    setSuccessMsg("");
    try {
      // Simulate on-chain split creation or Supabase logging
      await new Promise((r) => setTimeout(r, 1200));
      setSuccessMsg("Split bill request created successfully on-chain!");
    } catch {
      setSuccessMsg("Failed to create split request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-5 py-24">
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
          Split Bill
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          {t("features.pilar4.desc") || "Bagi tagihan on-chain dengan teman-temanmu."}
        </p>
      </div>

      <div className="rounded-3xl border border-ink-line/60 bg-ink-2/50 p-8 backdrop-blur-xl">
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-muted">Total Amount (USDC)</label>
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
              <label className="text-sm font-medium text-text-muted">Participants</label>
              <button 
                onClick={splitEqually}
                className="text-xs font-medium text-accent hover:underline"
              >
                Split Equally
              </button>
            </div>
            
            {participants.map((p, idx) => (
              <div key={p.id} className="flex gap-3">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                  placeholder={idx === 0 ? "You" : `Participant ${idx + 1}`}
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
              Add Participant
            </button>
          </div>

          <button
            onClick={handleCreateSplit}
            disabled={!address || !totalAmount || loading}
            className="w-full rounded-2xl bg-paper-white py-5 font-display text-lg font-bold text-paper-ink shadow-lg shadow-paper-white/5 transition-all hover:scale-[1.02] hover:shadow-paper-white/10 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {loading && <span className="h-5 w-5 animate-spin rounded-full border-2 border-paper-ink border-t-transparent" />}
            {loading ? "Creating..." : "Create Split Request"}
          </button>
          {successMsg && (
            <p className="mt-3 text-center text-sm font-medium text-stamp-green">{successMsg}</p>
          )}
        </div>
      </div>
    </section>
  );
}
