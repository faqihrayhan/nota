"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet, type WalletId } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import { ARC_EXPLORER_URL } from "@/lib/arc-chain";
import { cn } from "@/lib/utils";
import {
  Wallet,
  ChevronDown,
  ExternalLink,
  LogOut,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const WALLETS: { id: WalletId; label: string; monogram: string }[] = [
  { id: "metamask", label: "MetaMask", monogram: "MM" },
  { id: "okx", label: "OKX Wallet", monogram: "OKX" },
];

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* ============================================================
   WALLET BUTTON — Nota v2.0
   Features:
   - Enhanced dropdown with icons
   - Status indicators
   - Smooth animations
   - Compact mode for mobile
   ============================================================ */

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const wallet = useWallet();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const handleSwitchNetwork = async () => {
    setSwitching(true);
    setSwitchError("");
    try {
      await wallet.switchToArc();
    } catch (err) {
      const msg = (err as Error)?.message;
      if (msg === "no_provider") {
        setSwitchError(t("wallet.noProviderMobile"));
      } else if ((err as { code?: number })?.code === 4001) {
        setSwitchError(t("wallet.rejected"));
      } else {
        setSwitchError(t("wallet.switchFailed"));
      }
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handlePick = async (id: WalletId) => {
    await wallet.connect(id);
    setOpen(false);
  };

  // ── Connected state ──
  if (wallet.status === "connected" && wallet.address) {
    if (!wallet.isCorrectNetwork) {
      return (
        <div className="relative">
          <button
            onClick={handleSwitchNetwork}
            disabled={switching}
            className="group flex items-center gap-2 rounded-xl border border-warn-amber/50 bg-warn-amber/10 px-4 py-2.5 text-sm font-medium text-warn-amber transition-all duration-300 hover:bg-warn-amber/20 hover:border-warn-amber/70 disabled:opacity-60"
          >
            {switching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{t("wallet.switchNetwork")}</span>
            <span className="sm:hidden">Switch</span>
          </button>
          {switchError && (
            <p className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-warn-amber/40 bg-ink-2 px-3 py-2 text-xs text-warn-amber shadow-xl">
              {switchError}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="relative" ref={rootRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "group flex items-center gap-2 rounded-xl border bg-ink-2 px-4 py-2.5 font-mono text-sm transition-all duration-300",
            "border-ink-line/50 text-text hover:border-stamp-green/50 hover:bg-ink-3"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp-green opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-stamp-green" />
          </span>
          <span>{shortAddress(wallet.address)}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-text-muted transition-transform duration-300",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div
            className={cn(
              "z-50 mt-2 overflow-hidden rounded-2xl border border-ink-line/50 bg-ink-2 shadow-2xl shadow-black/40",
              compact ? "relative w-full" : "absolute right-0 w-60"
            )}
          >
            <div className="border-b border-ink-line/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-text-faint">
                {t("wallet.connectedVia")}
              </p>
              <p className="mt-0.5 text-sm font-medium capitalize">
                {wallet.walletId === "okx" ? "OKX Wallet" : "MetaMask"}
              </p>
            </div>
            <a
              href={`${ARC_EXPLORER_URL}/address/${wallet.address}`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 px-4 py-3 text-sm text-text transition-colors hover:bg-ink-3"
            >
              <ExternalLink className="h-3.5 w-3.5 text-text-muted" />
              {t("wallet.viewExplorer")}
            </a>
            <button
              onClick={() => {
                wallet.disconnect();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-warn-amber transition-colors hover:bg-ink-3"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("wallet.disconnect")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle / connecting / error state ──
  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={wallet.status === "connecting"}
        className={cn(
          "group inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all duration-300",
          "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          compact && "w-full justify-center"
        )}
      >
        {wallet.status === "connecting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("wallet.connecting")}</span>
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            <span>{t("wallet.connect")}</span>
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "z-50 mt-2 overflow-hidden rounded-2xl border border-ink-line/60 bg-ink-2 shadow-2xl shadow-black/60 ring-1 ring-black/40",
            compact ? "absolute left-0 right-0 w-full" : "absolute right-0 w-64"
          )}
        >
          <div className="border-b border-ink-line/30 bg-ink-2 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-text-faint">
              {t("wallet.pick")}
            </p>
          </div>
          {WALLETS.map((w) => {
            const available = wallet.isProviderAvailable(w.id);
            if (!available && wallet.isMobile) {
              return (
                <a
                  key={w.id}
                  href={wallet.mobileDeepLink(w.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 bg-ink-2 px-4 py-3 text-sm text-text transition-colors hover:bg-ink-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-3 border border-ink-line/30 font-mono text-[10px]">
                    {w.monogram}
                  </span>
                  <span className="font-medium">{t("wallet.openInApp")} {w.label}</span>
                </a>
              );
            }
            if (!available) {
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-4 py-3 text-sm text-text-muted"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-3 border border-ink-line/30 font-mono text-[10px] text-text-faint">
                      {w.monogram}
                    </span>
                    {w.label}
                  </span>
                  <span className="text-[11px] text-text-faint">{t("wallet.notDetected")}</span>
                </div>
              );
            }
            return (
              <button
                key={w.id}
                onClick={() => handlePick(w.id)}
                className="flex w-full items-center gap-3 bg-ink-2 px-4 py-3 text-left text-sm text-text transition-colors hover:bg-ink-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-3 border border-ink-line/30 font-mono text-[10px]">
                  {w.monogram}
                </span>
                {w.label}
              </button>
            );
          })}
          {wallet.status === "error" && wallet.error === "not_found" && (
            <p className="border-t border-ink-line/30 px-4 py-3 text-xs text-warn-amber">
              {t("wallet.notInstalled")}
            </p>
          )}
          {wallet.status === "error" && wallet.error === "rejected" && (
            <p className="border-t border-ink-line/30 px-4 py-3 text-xs text-warn-amber">
              {t("wallet.rejected")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
