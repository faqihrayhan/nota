"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getCatalog,
  addCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCart,
  addToCart,
  updateCartItemQty,
  removeFromCart,
  clearCart,
  getTransactions,
  getIncomingTransactions,
  getMerchantInflowStats,
  subscribeToTransactions,
  type CatalogItem,
  type CartItem,
  type Transaction,
  type MerchantInflowStats,
} from "@/lib/supabase";
import { ARC_EXPLORER_URL } from "@/lib/arc-chain";
import {  
  fetchExchangeRate,
  getCachedRate,
  idrToUsdc,
  usdcToIdr,
  formatIDR,
  formatUSDC,
  type ExchangeRate, type CurrencyCode, CURRENCY_SYMBOLS, fetchLiveRates, convertFromUsdc, convertToUsdc, formatCurrency } from "@/lib/exchange-rate";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ShoppingCart,
  X,
  Copy,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  AlertTriangle,
  Wallet,
  Package,
  Pencil,
  RefreshCcw,
  QrCode,
  TrendingUp,
  ChevronRight,
  Edit2,
  BarChart3,
  Calendar,
  Activity,
  ChevronDown
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { encodeQRPayload } from "@/lib/qr-hmac";

function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}

function encodeQR(data: Record<string, unknown>): string {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

export default function MerchantPage() {
  const wallet = useWallet();
  const { address } = wallet;
  const { t } = useLanguage();

  // UI State
  const [currencyMode, setCurrencyMode] = useState<CurrencyCode>("USDC");

  // Catalog state
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [newItemBatch, setNewItemBatch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editBatch, setEditBatch] = useState("");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);

  // QR state
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrTotal, setQrTotal] = useState(0);
  const [qrNonce, setQrNonce] = useState("");

  // Inflow Stats state
  const [inflowStats, setInflowStats] = useState<MerchantInflowStats | null>(null);
  const [inflowLoading, setInflowLoading] = useState(false);
  const [showInflow, setShowInflow] = useState(true);
  const [error, setError] = useState("");

  // History state
  const [history, setHistory] = useState<Transaction[]>([]);
  // Incoming payments (payee = me) — only NEW payments via realtime (not history)
  const [incoming, setIncoming] = useState<Transaction[]>([]);
  // Latest confirmed payment detected in realtime → drives the success UI
  const [paidTx, setPaidTx] = useState<Transaction | null>(null);
  // Nonces already shown this session (prevents duplicate banners/modals)
  const seenNoncesRef = useRef<Set<string>>(new Set());

  // Live IDR⇄USDC rate (fetched from CoinGecko; falls back offline)
  const [rate, setRate] = useState<ExchangeRate>(() => getCachedRate());
  const [refreshingRate, setRefreshingRate] = useState(false);
  const [allRates, setAllRates] = useState<Record<string, number>>({});
  const [rateSource, setRateSource] = useState<"coingecko" | "fallback">(() => getCachedRate().source as "coingecko" | "fallback");

  // Load data on wallet connect
  async function loadInflowStats() {
    if (!address) return;
    setInflowLoading(true);
    try {
      const stats = await getMerchantInflowStats(address);
      setInflowStats(stats);
    } catch (err) {
      console.error("Failed to load inflow stats:", err);
    } finally {
      setInflowLoading(false);
    }
  }

  useEffect(() => {
    if (!address) return;
    loadCatalog();
    loadCart();
    loadHistory();
    loadInflowStats();
    // NOTE: loadIncoming() is intentionally NOT called on mount — the banner
    // shows only NEW payments arriving via realtime, not historical ones.
    const unsub = subscribeToTransactions(() => {
      loadCatalog();
      loadHistory();
      loadIncoming();
      loadInflowStats();
    });
    return () => unsub();
  }, [address]);

  // Refresh the exchange rate on mount
  useEffect(() => {
    let active = true;
    fetchExchangeRate().then(async (r) => {
      if (active) {
        setRate(r);
        const lRates = await fetchLiveRates();
        setAllRates(lRates.rates);
        setRateSource(lRates.source);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Manual refresh: pull the latest rate on demand.
  // Hanya memperbarui kurs tampilan (harga katalog tetap, isi keranjang
  // otomatis ikut dihitung ulang dengan rate baru).
  async function handleRefreshRate() {
    if (refreshingRate) return;
    setRefreshingRate(true);
    try {
      const fresh = await fetchExchangeRate();
      setRate(fresh);
      const lRates = await fetchLiveRates();
      setAllRates(lRates.rates);
      setRateSource(lRates.source);
    } catch {
      // fetchExchangeRate never throws (falls back to default), keep old rate
    } finally {
      setRefreshingRate(false);
    }
  }

  async function loadCatalog() {
    if (!address) return;
    setCatalogLoading(true);
    try {
      const items = await getCatalog(address);
      setCatalog(items);
    } catch (err) {
      console.error("Failed to load catalog:", err);
      setError(t("merchant.failedToLoadCatalog"));
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadCart() {
    if (!address) return;
    setCartLoading(true);
    try {
      const items = await getCart(address);
      setCart(items);
    } catch (err) {
console.error("Failed to load cart:", err);
    } finally {
      setCartLoading(false);
    }
  }

  async function loadHistory() {
    if (!address) return;
    try {
      const txs = await getTransactions(address);
      setHistory(txs);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  async function loadIncoming() {
    if (!address) return;
    try {
      const txs = await getIncomingTransactions(address);
      setIncoming(txs);
      // A payment that arrived via realtime gets surfaced as a success UI.
      // We track nonces already shown this session so the banner/modal only
      // fires ONCE per payment (and not for historical rows on mount).
      const fresh = txs.filter((tx) => {
        if (tx.status !== "confirmed") return false;
        if (tx.nonce && seenNoncesRef.current.has(tx.nonce)) return false;
        return true;
      });
      for (const tx of fresh) {
        if (tx.nonce) seenNoncesRef.current.add(tx.nonce);
      }
      if (fresh.length > 0) {
        setPaidTx(fresh[0]);
      }
    } catch (err) {
      console.error("Failed to load incoming payments:", err);
    }
  }

  // Cart calculations — harga asli disimpan dalam USDC, IDR adalah turunan.
  const cartTotalUSDC = cart.reduce((sum, item) => sum + item.price_usdc * item.qty, 0);
  const cartTotalCurrent = convertFromUsdc(cartTotalUSDC, currencyMode, allRates);
  // Total display — selalu tampilkan dalam currency aktif, USDC sebagai acuan.
  const formattedTotal = formatCurrency(convertFromUsdc(cartTotalUSDC, currencyMode, allRates), currencyMode);

  const toggleCurrency = () => {
    setCurrencyMode((m) => (m === "IDR" ? "USDC" : "IDR"));
  };

  // Add item to catalog
  async function handleAddToCatalog(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!address || !newItemName.trim() || !newItemPrice.trim()) return;
    const priceNum = parseFloat(newItemPrice.replace(/[^0-9.]/g, ""));
    if (isNaN(priceNum) || priceNum <= 0) return;
    const priceUsdc = currencyMode === "USDC" ? priceNum : convertToUsdc(priceNum, currencyMode, allRates);
    const stockNum = newItemStock ? parseFloat(newItemStock) : 0;
    try {
      await addCatalogItem(address, newItemName.trim(), priceUsdc, {
        stock: stockNum,
        batch_no: newItemBatch.trim() || undefined,
      });
      setNewItemName("");
      setNewItemPrice("");
      setNewItemStock("");
      setNewItemBatch("");
      setIsAdding(false);
      await loadCatalog();
    } catch (err) {
      setError(t("merchant.failedToAddItem"));
      console.error(err);
    }
  }

  // Edit item in catalog
  function startEditItem(item: CatalogItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(currencyMode === "IDR"
      ? Math.round(usdcToIdr(item.price_usdc, rate.idrPerUsdc)).toString()
      : item.price_usdc.toString());
    setEditStock(item.stock != null ? item.stock.toString() : "");
    setEditBatch(item.batch_no || "");
    setIsAdding(false);
  }

  function cancelEditItem() {
    setEditingItem(null);
    setEditName("");
    setEditPrice("");
    setEditStock("");
    setEditBatch("");
  }

  async function handleSaveEdit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!address || !editingItem || !editName.trim() || !editPrice.trim()) return;
    const priceNum = parseFloat(editPrice.replace(/[^0-9.]/g, ""));
    if (isNaN(priceNum) || priceNum <= 0) return;
    const priceUsdc = currencyMode === "USDC" ? priceNum : convertToUsdc(priceNum, currencyMode, allRates);
    const stockNum = editStock ? parseFloat(editStock) : 0;
    try {
      await updateCatalogItem(editingItem.id, editName.trim(), priceUsdc, {
        stock: stockNum,
        batch_no: editBatch.trim() || undefined,
      });
      cancelEditItem();
      await loadCatalog();
    } catch (err) {
      setError(t("merchant.failedToAddItem"));
      console.error(err);
    }
  }

  async function handleAddToCart(item: CatalogItem) {
    if (!address) return;
    try {
      await addToCart(address, item.name, 1, item.price_usdc);
      await loadCart();
    } catch (err) {
      setError(t("merchant.failedToAddToCart"));
      console.error(err);
    }
  }

  async function handleUpdateQty(item: CartItem, delta: number) {
    const newQty = item.qty + delta;
    if (newQty < 1) return;
    try {
      await updateCartItemQty(item.id, newQty);
      await loadCart();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveFromCart(id: string) {
    try {
      await removeFromCart(id);
      await loadCart();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClearCart() {
    if (!address) return;
    try {
      await clearCart(address);
      await loadCart();
    } catch (err) {
      console.error(err);
    }
  }

  // Generate QR from cart
  async function handleGenerateQR() {
    if (cart.length === 0) return;
    const nonce = generateNonce();
    const totalUsdcVal = cartTotalUSDC;
    const itemsForQR = cart.map((item) => ({
      name: item.item_name,
      price: Math.round(item.price_usdc * 1_000_000), // convert to USDC units (micro-USDC)
      qty: item.qty,
    }));

    const qrPayload = {
      payerAddress: address || "",
      totalAmount: (totalUsdcVal * 1_000_000).toFixed(0),
      items: itemsForQR,
      category: "merchant_pos",
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      nonce,
    };

    const encoded = await encodeQRPayload(qrPayload);
    setQrData(encoded);
    setQrNonce(nonce);
    setQrTotal(totalUsdcVal);
    setError("");
  }

  if (!address) {
    return (
      <>
<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-bg to-bg" />
        <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-8 md:pt-36">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line/40 bg-ink-2/30 p-12 text-center">
              <Wallet className="h-12 w-12 text-text-muted" />
              <h2 className="mt-4 font-display text-xl font-semibold">{t("merchant.connectFirst")}</h2>
              <p className="mt-2 text-sm text-text-muted">{t("merchant.connectDesc")}</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-bg to-bg" />
      <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-8 md:pt-36">
        <div className="mx-auto w-full max-w-6xl">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.30em] text-primary">{t("merchant.eyebrow")}</p>
              <h1 className="mt-3 text-balance text-4xl font-black tracking-tight text-text sm:text-5xl">
                {t("merchant.title")}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-text-secondary">
                {t("merchant.desc")}
              </p>
            </div>
          </div>

          {/* Merchant Inflow Stats Summary */}
          {inflowStats && (
            <div className="mb-8 rounded-2xl border border-primary/20 bg-card/40 p-5 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-text">{t("merchant.revenueSummary")}</h2>
                    <p className="text-xs text-text-muted">{t("merchant.revenueDesc")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInflow(!showInflow)}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
                >
                  {showInflow ? t("merchant.hide") : t("merchant.show")}
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showInflow && "rotate-180")} />
                </button>
              </div>

              {showInflow && (
                <div className="space-y-4 pt-2 border-t border-border/40">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border/50 bg-background/50 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> {t("merchant.totalRevenue")}
                      </div>
                      <p className="text-lg font-bold text-text font-mono">
                        {inflowStats.totalRevenueUsdc.toFixed(2)} <span className="text-xs text-primary font-sans font-normal">USDC</span>
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        ≈ {formatCurrency(convertFromUsdc(inflowStats.totalRevenueUsdc, currencyMode, allRates), currencyMode)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-background/50 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> {t("merchant.todayRevenue")}
                      </div>
                      <p className="text-lg font-bold text-text font-mono">
                        {inflowStats.todayRevenueUsdc.toFixed(2)} <span className="text-xs text-primary font-sans font-normal">USDC</span>
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        ≈ {formatCurrency(convertFromUsdc(inflowStats.todayRevenueUsdc, currencyMode, allRates), currencyMode)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-background/50 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                        <Activity className="w-3.5 h-3.5 text-amber-500" /> {t("merchant.totalIncomingTx")}
                      </div>
                      <p className="text-lg font-bold text-text font-mono">
                        {inflowStats.totalTransactionsCount} <span className="text-xs text-text-muted font-sans font-normal">{t("merchant.txs")}</span>
                      </p>
                    </div>
                  </div>

                  {inflowStats.topSellingItems.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-semibold text-text-muted mb-2">{t("merchant.topSellingItems")}</p>
                      <div className="flex flex-wrap gap-2">
                        {inflowStats.topSellingItems.map((item, idx) => (
                          <div key={idx} className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-1.5 text-xs">
                            <span className="font-medium text-text">{item.name}</span>
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{item.count}x {t("merchant.sold")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Incoming payment banner (auto-detected) */}
        {incoming.length > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-stamp-green/30 bg-stamp-green/5 px-4 py-3 text-sm">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp-green opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-stamp-green" />
            </span>
            <span className="text-stamp-green">
              <span className="font-semibold">{t("merchant.newPaymentDetected")}</span>{" "}
              {incoming.length} {incoming.length > 1 ? t("merchant.paymentsReceived") : t("merchant.paymentReceived")} —{" "}
              {formatUSDC(incoming.reduce((s, tx) => s + tx.amount, 0))} USDC
            </span>
          </div>
        )}

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-warn-amber/40 bg-warn-amber/10 px-4 py-3 text-sm text-warn-amber">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Catalog */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">{t("merchant.catalog")}</h2>
                  <button
                    onClick={() => loadCatalog()}
                    disabled={catalogLoading}
                    title={t("merchant.refreshCatalog")}
                    className="ml-1 inline-flex items-center justify-center rounded-lg border border-ink-line/40 p-1.5 text-text-muted transition-all hover:border-primary/50 hover:text-primary disabled:opacity-50"
                  >
                    <RefreshCcw className={cn("h-3.5 w-3.5", catalogLoading && "animate-spin")} />
                  </button>
                </div>
                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                >
                  <Plus className="h-3 w-3" />
                  {isAdding ? t("merchant.cancel") : t("merchant.addItem")}
                </button>
              </div>

              {/* Add item form */}
              {isAdding && (
                <form onSubmit={handleAddToCatalog} className="rounded-2xl border border-primary/30 bg-ink-2/50 p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder={t("merchant.itemName")}
                      className="flex-1 rounded-xl border border-ink-line/40 bg-ink px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                    />
                    <div className="flex rounded-xl border border-ink-line/40 bg-ink overflow-hidden focus-within:border-primary sm:w-40">
                      <span className="flex items-center bg-ink-2/80 px-3 text-xs font-semibold text-text-muted border-r border-ink-line/30 select-none">
                        {CURRENCY_SYMBOLS[currencyMode].trim()}
                      </span>
                      <input
                        type="text"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        placeholder={currencyMode === "USDC" ? "1.50" : "25.000"}
                        className="w-full bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="number"
                      value={newItemStock}
                      onChange={(e) => setNewItemStock(e.target.value)}
                      placeholder="Stok (e.g. 100)"
                      className="w-full rounded-xl border border-ink-line/40 bg-ink px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none sm:w-1/2"
                    />
                    <input
                      type="text"
                      value={newItemBatch}
                      onChange={(e) => setNewItemBatch(e.target.value)}
                      placeholder="No. Batch / SKU (Opsional)"
                      className="w-full rounded-xl border border-ink-line/40 bg-ink px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none sm:w-1/2"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-strong"
                    >
                      {t("merchant.add")}
                    </button>
                  </div>
                </form>
              )}

              {/* Catalog items */}
              <div className="space-y-2">
                {catalogLoading ? (
                  <div className="flex items-center justify-center py-12 text-text-muted">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : catalog.length === 0 ? (
                  <div className="rounded-2xl border border-ink-line/30 bg-ink-2/20 p-8 text-center">
                    <Package className="mx-auto h-10 w-10 text-text-muted/40" />
                    <p className="mt-3 text-sm text-text-muted">{t("merchant.emptyCatalog")}</p>
                  </div>
                ) : (
                  catalog.map((item) =>
                    editingItem?.id === item.id ? (
                      /* Inline edit form */
                      <form
                        key={item.id}
                        onSubmit={handleSaveEdit}
                        className="rounded-2xl border border-accent/40 bg-ink-2/50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t("merchant.itemName")}
                            className="flex-1 rounded-xl border border-ink-line/40 bg-ink px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                          />
                          <div className="flex rounded-xl border border-ink-line/40 bg-ink overflow-hidden focus-within:border-primary sm:w-40">
                      <span className="flex items-center bg-ink-2/80 px-3 text-xs font-semibold text-text-muted border-r border-ink-line/30 select-none">
                        {CURRENCY_SYMBOLS[currencyMode].trim()}
                      </span>
                      <input
                        type="text"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder={currencyMode === "USDC" ? "1.50" : "25.000"}
                        className="w-full bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none"
                      />
                    </div>
                          <button
                            type="submit"
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-strong"
                          >
                            {t("merchant.save")}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditItem}
                            className="rounded-xl border border-ink-line/40 px-4 py-2 text-sm text-text-muted transition-all hover:bg-ink-2 hover:text-text"
                          >
                            {t("merchant.cancel")}
                          </button>
                        </div>
                      </form>
                    ) : (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between rounded-2xl border border-ink-line/30 bg-ink-2/20 p-4 transition-all hover:border-ink-line/60 hover:bg-ink-2/40"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text">{item.name}</p>
                          {item.stock != null && item.stock > 0 && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Stok: {item.stock}
                            </span>
                          )}
                          {item.batch_no && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              Batch: {item.batch_no}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-muted">
                          {formatUSDC(item.price_usdc)}
                          {currencyMode !== "USDC" && (
                            <span>
                              {" ≈ "}
                              {formatCurrency(convertFromUsdc(item.price_usdc, currencyMode, allRates), currencyMode)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                        <button
                          onClick={() => startEditItem(item)}
                          className="rounded-xl p-2 text-text-muted transition-all hover:bg-ink-line/40 hover:text-text"
                          title={t("merchant.editItem")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="rounded-xl bg-primary/10 p-2 text-primary transition-all hover:bg-primary/20"
                          title={t("merchant.addToCart")}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await deleteCatalogItem(item.id);
                            await loadCatalog();
                          }}
                          className="rounded-xl p-2 text-text-muted transition-all hover:bg-ink-line/40 hover:text-text"
                          title={t("merchant.deleteItem")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    )
                  )
                )}
              </div>
            </div>

            {/* Right: Cart */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">{t("merchant.cart")}</h2>
                </div>
                <div className="inline-flex items-center rounded-xl border border-ink-line/40 bg-ink-2/60 p-1">
                  {(["USDC", "IDR", "MYR", "SGD"] as const).map((curr) => (
                    <button
                      key={curr}
                      onClick={() => setCurrencyMode(curr)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                        currencyMode === curr
                          ? "bg-accent text-white shadow-sm font-semibold"
                          : "text-text-muted hover:text-text hover:bg-white/5"
                      )}
                    >
                      {curr === "USDC" ? "🇺🇸 USDC" : curr === "IDR" ? "🇮🇩 IDR" : curr === "MYR" ? "🇲🇾 MYR" : "🇸🇬 SGD"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn("rounded-2xl border transition-all", cart.length === 0 ? "border-ink-line/30 bg-ink-2/20" : "border-primary/30 bg-primary/5")}> 
                {cartLoading ? (
                  <div className="flex items-center justify-center py-12 text-text-muted">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ShoppingCart className="h-10 w-10 text-text-muted/40" />
                    <p className="mt-3 text-sm text-text-muted">{t("merchant.emptyCart")}</p>
                    <p className="mt-1 text-xs text-text-muted/70">{t("merchant.emptyCartHint")}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-ink-line/20 p-4">
                      <span className="text-sm font-semibold">{t("merchant.cartItems")}</span>
                      <button
                        onClick={handleClearCart}
                        className="text-xs font-medium text-warn-amber hover:underline"
                      >
                        {t("merchant.clearCart")}
                      </button>
                    </div>
                    <div className="divide-y divide-ink-line/20">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <p className="font-medium text-text">{item.item_name}</p>
                            <p className="text-sm text-text-muted">
                              {`${formatCurrency(convertFromUsdc(item.price_usdc, currencyMode, allRates), currencyMode)} × ${item.qty}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 rounded-xl border border-ink-line/40 bg-ink">
                              <button
                                onClick={() => handleUpdateQty(item, -1)}
                                className="p-1.5 text-text-muted hover:text-text"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                              <button
                                onClick={() => handleUpdateQty(item, 1)}
                                className="p-1.5 text-text-muted hover:text-text"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="rounded-xl p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="border-t border-ink-line/30 p-4">
                      <div className="flex justify-between text-sm mb-2">
<span className="text-text-muted">{t("merchant.subtotal")}</span>
                        <span>{formatCurrency(convertFromUsdc(cartTotalUSDC, currencyMode, allRates), currencyMode)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">{t("merchant.total")}</span>
                        <span className="font-bold text-primary">{formattedTotal}</span>
                      </div>
                      {currencyMode !== "USDC" && (
                        <div className="mt-1 text-right text-xs text-text-muted">
                          ≈ {formatUSDC(cartTotalUSDC)}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-text-muted/60">
                        <span>
                          1 USDC ≈ {formatCurrency(allRates[currencyMode] || 1, currencyMode)}
                          {rateSource === "coingecko" ? ` (${t("merchant.liveRate")})` : ` (${t("merchant.estimateRate")})`}
                         </span>
                        <button
                          onClick={handleRefreshRate}
                          disabled={refreshingRate}
                          title={t("merchant.refreshRate")}
                          className="rounded-md p-1 text-text-muted/60 transition-colors hover:bg-ink-line/40 hover:text-text disabled:opacity-50"
                        >
                          <RefreshCcw className={cn("h-3 w-3", refreshingRate && "animate-spin")} />
                        </button>
                      </div>
                    </div>

                    {/* Generate QR button */}
                    <div className="p-4 pt-0">
                      <button
                        onClick={handleGenerateQR}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-strong hover:shadow-lg hover:shadow-primary/20"
                      >
                        <QrCode className="h-4 w-4" />
                        {t("merchant.generateQR")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QR Modal */}
        {qrData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-primary/40 bg-ink p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">{t("merchant.paymentQR")}</span>
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
                <p className="text-2xl font-bold text-primary">{formattedTotal}</p>
                {currencyMode !== "USDC" && (
                  <p className="text-sm text-text-muted">≈ {formatUSDC(cartTotalUSDC)}</p>
                )}
              </div>

              <button
                onClick={() => { navigator.clipboard.writeText(qrData); }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-ink-line/40 px-4 py-2 text-sm text-text-muted hover:bg-ink-2 hover:text-text mb-3"
              >
                <Copy className="h-4 w-4" />
                {t("merchant.copyQR")}
              </button>

              {/* Auto-detect status */}
              {incoming.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-stamp-green/30 bg-stamp-green/5 px-4 py-2.5 text-xs text-stamp-green">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-stamp-green opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-stamp-green" />
                  </span>
                  {t("merchant.realtimeActive")} · {incoming.length} {t("merchant.paymentsReceived")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mx-auto mt-12 w-full max-w-6xl">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-text-muted" />
              <h2 className="font-display text-lg font-semibold">{t("merchant.recentTx")}</h2>
            </div>
            <div className="space-y-2">
              {history.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl border border-ink-line/30 bg-ink-2/20 p-4 transition-all hover:border-ink-line/60 hover:bg-ink-2/40"
                >
                  <div>
                    <p className="font-medium capitalize">{tx.category}</p>
                    <p className="text-sm text-text-muted">
                      {new Date(tx.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      <span className="font-mono text-xs">{tx.payee_address.slice(0, 10)}…</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatUSDC(tx.amount)}</p>
                    <p className={cn("text-xs capitalize", tx.status === "confirmed" ? "text-stamp-green" : tx.status === "failed" ? "text-warn-amber" : "text-text-muted")}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Realtime payment success (auto-detected) ══ */}
        {paidTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-stamp-green/50 bg-ink p-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stamp-green/15">
                  <CheckCircle2 className="h-7 w-7 text-stamp-green" />
                </div>
                <button
                  onClick={() => setPaidTx(null)}
                  className="rounded-xl p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="mt-4 font-display text-xl font-bold text-stamp-green">
                {t("merchant.paidSuccessTitle")}
              </h3>
              <p className="mt-1 text-sm text-text-muted">{t("merchant.paidSuccessDesc")}</p>

              <div className="mt-5 space-y-2.5 rounded-xl border border-ink-line/30 bg-ink-2/40 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("merchant.amount")}</span>
                  <span className="font-mono font-semibold text-stamp-green">
                    +{formatUSDC(paidTx.amount)} USDC
                  </span>
                </div>
                {Array.isArray(paidTx.items) && paidTx.items.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t("merchant.itemsInPayment")}</span>
                    <span className="text-text">
                      {paidTx.items
                        .map((it: { name: string; qty?: number }) => `${it.name}${it.qty && it.qty > 1 ? ` ×${it.qty}` : ""}`)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {paidTx.tx_hash && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t("merchant.txHash")}</span>
                    <a
                      href={`https://testnet.arcscan.app/tx/${paidTx.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-accent hover:text-accent-strong"
                    >
                      {paidTx.tx_hash.slice(0, 10)}…{paidTx.tx_hash.slice(-8)}
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setPaidTx(null)}
                  className="flex-1 rounded-xl bg-stamp-green px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-stamp-green/90"
                >
                  {t("merchant.continue")}
                </button>
                <button
                  onClick={() => {
                    setPaidTx(null);
                    clearCart(address || "");
                    loadCart();
                    loadCatalog();
                    loadHistory();
                    setQrData(null);
                  }}
                  className="flex-1 rounded-xl border border-ink-line/40 px-4 py-3 text-sm text-text-muted transition-all hover:bg-ink-2 hover:text-text"
                >
                  {t("merchant.newOrder")}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
