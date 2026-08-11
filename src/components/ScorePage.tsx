"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useWallet } from "@/context/WalletContext";
import { getTransactions } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  History,
  Award,
  Zap,
  BarChart3,
  Loader2
} from "lucide-react";

export function ScorePage() {
  const { t } = useLanguage();
  const { address } = useWallet();
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [txCount, setTxCount] = useState(0);

  useEffect(() => {
    async function calculateScore() {
      if (!address) {
        setLoading(false);
        return;
      }
      
      try {
        const txs = await getTransactions(address);
        const count = txs.length;
        setTxCount(count);
        
        // Simple logic: base score 300, +20 points per transaction, max 850
        const calculated = Math.min(850, 300 + (count * 20));
        setScore(calculated);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    calculateScore();
  }, [address]);

  const getScoreColor = (s: number) => {
    if (s >= 750) return "text-stamp-green";
    if (s >= 600) return "text-warn-amber";
    return "text-paper-pink";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 750) return "Excellent";
    if (s >= 600) return "Good";
    return "Basic";
  };

  if (!address) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-32 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-ink-2/50 border border-ink-line/60">
          <Zap className="h-10 w-10 text-text-muted" />
        </div>
        <h1 className="font-display text-3xl font-bold text-text">Connect Wallet First</h1>
        <p className="mt-4 text-text-muted">Connect your wallet to see your Nota reputation score.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-24">
      <div className="mb-16">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">
          Nota Score
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          Your Financial Reputation On Arc network
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-3">
          <div className="col-span-1 md:col-span-2">
            <div className="rounded-3xl border border-ink-line/60 bg-ink-2/50 p-10 backdrop-blur-xl">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6 flex h-48 w-48 items-center justify-center rounded-full border-8 border-ink/50 bg-ink-2 shadow-inner">
                  <div className={cn("font-display text-6xl font-black", score ? getScoreColor(score) : "text-text-muted")}>
                    {score || "—"}
                  </div>
                  <div className="absolute -bottom-2 rounded-full bg-paper-white px-4 py-1 text-xs font-bold text-paper-ink uppercase tracking-wider">
                    {score ? getScoreLabel(score) : "No Data"}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-text">Trust Reputation</h3>
                <p className="mt-2 max-w-xs text-sm text-text-muted">
                  Your Scores Based On History Payment and Settlement On Arc Testnet
                </p>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-4 border-t border-ink-line/40 pt-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-text font-display">{txCount}</div>
                  <div className="text-xs text-text-muted uppercase tracking-widest mt-1">Transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-text font-display">100%</div>
                  <div className="text-xs text-text-muted uppercase tracking-widest mt-1">Settlement</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-line/60 bg-ink-2/30 p-6">
              <div className="flex items-center gap-3 text-accent">
                <Award className="h-5 w-5" />
                <h4 className="font-semibold">Perks</h4>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-text-muted">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-stamp-green" />
                  Lower lending rates
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-stamp-green" />
                  Higher withdrawal limits
                </li>
                <li className="flex items-center gap-2 opacity-50">
                  <ShieldCheck className="h-4 w-4" />
                  Early access to Arc DeFi
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-warn-amber/20 bg-warn-amber/5 p-6">
              <div className="flex items-center gap-3 text-warn-amber">
                <TrendingUp className="h-5 w-5" />
                <h4 className="font-semibold">Improve Score</h4>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-text-muted">
                Do more transaction on Arc Testnet with Using Features Payment Or Split Bill For making Great Scores.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
