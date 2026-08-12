"use client";

import { useState, useEffect } from "react";
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
  subscribeToTransactions,
  type CatalogItem,
  type CartItem,
  type Transaction,
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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  const [error, setError] = useState("");

  // History state
  const [history, setHistory] = useState<Transaction[]>([]);
  // Incoming payments (payee = me) — auto-detected via realtime
  const [incoming, setIncoming] = useState<Transaction[]>([]);

  // Live IDR⇄USDC rate (fetched from CoinGecko; falls back offline)
  const [rate, setRate] = useState<ExchangeRate>(() => getCachedRate());
  const [refreshingRate, setRefreshingRate] = useState(false);
  const [allRates, setAllRates] = useState<Record<string, number>>({});

  // Load data on wallet connect
  useEffect(() => {
    if (!address) return;
    loadCatalog();
    loadCart();
    loadHistory();
    loadIncoming();
    const unsub = subscribeToTransactions(() => {
      loadHistory();
      loadIncoming();
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
        setAllRates(lRates);
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
      setAllRates(lRates);
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
    } catch (err) {
      console.error("Failed to load incoming payments:", err);
    }
  }

  // Cart calculations — harga asli disimpan dalam USDC, IDR adalah turunan.
  const cartTotalUSDC = cart.reduce((sum, item) => sum + item.price_usdc * item.qty, 0);
  const cartTotalCurrent = convertFromUsdc(cartTotalUSDC, currencyMode, allRates);
  const cartTotalIDR = usdcToIdr(cartTotalUSDC, rate.idrPerUsdc);
  const formattedTotal =
    currencyMode === "IDR" ? formatIDR(cartTotalIDR) : formatUSDC(cartTotalUSDC);

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
  function handleGenerateQR() {
    if (cart.length === 0) return;
    const nonce = generateNonce();
    const totalUsdcVal = cartTotalUSDC;
    const itemsForQR = cart.map((item) => ({
      name: item.item_name,
      price: item.price_usdc,
    }));

    const qrPayload = {
      payerAddress: address,
      totalAmount: (totalUsdcVal * 1_000_000).toFixed(0),
      items: itemsForQR,
      category: "belanja",
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      nonce,
    };

    const encoded = encodeQR(qrPayload);
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
            {history.length > 0 && (
              <a
                href={`${ARC_EXPLORER_URL}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-ink-line/40 px-4 py-2 text-sm text-text-muted transition-colors hover:bg-ink-2 hover:text-text"
              >
                {t("merchant.viewAllTx")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

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
                          {currencyMode === "IDR" && ` ≈ ${formatIDR(usdcToIdr(item.price_usdc, rate.idrPerUsdc))}`}
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
                          1 USDC ≈ {formatIDR(Math.round(rate.idrPerUsdc))}
                          {rate.source === "coingecko" ? ` (${t("merchant.liveRate")})` : ` (${t("merchant.estimateRate")})`}
                        </span>
                        <button
                          onClick={handleRefreshRate}
                          disabled={refreshingRate}
                          title="Refresh rate"
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
      </section>
    </>
  );
}
