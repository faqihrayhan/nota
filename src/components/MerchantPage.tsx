"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, Minus, X, Trash2, QrCode, RefreshCcw, ArrowLeft, ShoppingCart, Package, CheckCircle2, Wallet, Lock } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

type CurrencyMode = "USDC" | "IDR";

interface CatalogItem {
  id: string;
  name: string;
  priceUSDC: number; // basis amount, e.g. 2.5
  icon: string; // lucide icon name (fallback: Package)
}

interface CartItem extends CatalogItem {
  qty: number;
}

// Mock kurs: 1 USDC ~ Rp 16.200
const USDC_IDR_RATE = 16200;

const DEFAULT_CATALOG: CatalogItem[] = [
  { id: "kopi-susu-gula-aren", name: "Kopi Susu Gula Aren", priceUSDC: 1.54, icon: "Package" },
  { id: "croissant-butter", name: "Croissant Butter", priceUSDC: 1.23, icon: "Package" },
  { id: "nasi-goreng-spesial", name: "Nasi Goreng Spesial", priceUSDC: 2.47, icon: "Package" },
  { id: "es-teh-manis", name: "Es Teh Manis", priceUSDC: 0.62, icon: "Package" },
  { id: "air-mineral", name: "Air Mineral", priceUSDC: 0.37, icon: "Package" },
  { id: "jus-alpukat", name: "Jus Alpukat", priceUSDC: 1.85, icon: "Package" },
];

export function MerchantPage() {
  const { address, status, connect, isCorrectNetwork } = useWallet();
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mode, setMode] = useState<CurrencyMode>("IDR");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nota_merchant_catalog");
      if (saved) {
        setCatalog(JSON.parse(saved));
      } else {
        setCatalog(DEFAULT_CATALOG);
      }
    } catch (e) {
      setCatalog(DEFAULT_CATALOG);
    }
  }, []);

  const saveCatalog = (list: CatalogItem[]) => {
    setCatalog(list);
    localStorage.setItem("nota_merchant_catalog", JSON.stringify(list));
  };

  const connected = status === "connected" && !!address;

  const totalUSDC = useMemo(() => cart.reduce((sum, i) => sum + i.priceUSDC * i.qty, 0), [cart]);
  const totalIDR = useMemo(() => Math.round(totalUSDC * USDC_IDR_RATE), [totalUSDC]);

  const formatAmount = (usdc: number) => {
    if (mode === "IDR") {
      return `Rp ${Math.round(usdc * USDC_IDR_RATE).toLocaleString("id-ID")}`;
    }
    return `${usdc.toFixed(2)} USDC`;
  };

  const toggleMode = () => {
    setMode((m) => (m === "IDR" ? "USDC" : "IDR"));
  };

  const addToCart = (item: CatalogItem) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === item.id);
      if (found) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => setCart([]);

  const removeCatalogItem = (id: string) => {
    const updated = catalog.filter((i) => i.id !== id);
    saveCatalog(updated);
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const addNewItem = () => {
    if (!newName.trim() || !newPrice.trim()) return;
    const priceNum = parseFloat(newPrice.replace(/[^0-9.]/g, ""));
    if (isNaN(priceNum) || priceNum <= 0) return;
    // Normalize: harga selalu disimpan dalam USDC
    const priceUSDC = mode === "IDR" ? priceNum / USDC_IDR_RATE : priceNum;
    const item: CatalogItem = {
      id: `${newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: newName.trim(),
      priceUSDC,
      icon: "Package",
    };
    saveCatalog([...catalog, item]);
    setNewName("");
    setNewPrice("");
    setIsAdding(false);
  };

  const generatePaymentLink = () => {
    const cartText = cart
      .map((i) => `${i.qty}x ${i.name}`)
      .join(", ");
    return `/payment?source=merchant&items=${encodeURIComponent(cartText)}&amount=${totalUSDC.toFixed(2)}`;
  };

  return (
    <>
      <Nav />
      <section className="relative min-h-[100svh] overflow-hidden px-5 pb-16 pt-28 sm:px-8 md:pt-36">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-bg to-bg" />
        <div className="mx-auto w-full max-w-6xl">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.30em] text-primary">
                {t("merchant.eyebrow")}
              </p>
              <h1 className="mt-3 text-balance text-4xl font-black tracking-tight text-text sm:text-5xl">
                {t("merchant.title")}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-text-secondary">
                {t("merchant.desc")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMode}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary transition hover:border-primary/50 hover:text-text"
                title={t("merchant.priceNote")}
              >
                <RefreshCcw size={14} />
                {mode === "IDR" ? t("merchant.switchToUSDC") : t("merchant.switchToIDR")}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Catalog */}
            <div className="glass-panel rounded-3xl border border-border-strong p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text">{t("merchant.catalog")}</h2>
                  <p className="text-xs text-text-muted mt-1">{t("merchant.tapToAdd")}</p>
                </div>
                <button
                  onClick={() => setIsAdding((s) => !s)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary transition hover:bg-primary/20"
                  aria-label={t("merchant.addItem")}
                >
                  {isAdding ? <X size={18} /> : <Plus size={18} />}
                </button>
              </div>

              {isAdding && (
                <div className="mb-5 space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t("merchant.itemName")}
                      className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted outline-none focus:border-primary/55"
                    />
                    <input
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder={
                        mode === "IDR"
                          ? t("merchant.priceHintIDR")
                          : t("merchant.priceHintUSDC")
                      }
                      className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted outline-none focus:border-primary/55"
                    />
                    <button
                      onClick={addNewItem}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-bg transition hover:brightness-110"
                    >
                      <Plus size={16} />
                      {t("merchant.addItem")}
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted">{t("merchant.priceNote")}</p>
                </div>
              )}

              {catalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
                  <Package size={32} className="text-text-muted" />
                  <p className="mt-4 text-sm text-text-secondary">{t("merchant.emptyCatalog")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {catalog.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                    >
                      <button
                        onClick={() => addToCart(item)}
                        className="flex flex-1 flex-col items-start gap-2 text-left"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition">
                          <Package size={18} />
                        </div>
                        <p className="text-sm font-semibold text-text leading-snug">{item.name}</p>
                        <p className="text-xs font-bold text-primary">{formatAmount(item.priceUSDC)}</p>
                      </button>
                      <button
                        onClick={() => removeCatalogItem(item.id)}
                        className="absolute right-2 top-2 rounded-lg p-1 text-text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        aria-label={t("merchant.deleteItem")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="glass-panel-strong flex flex-col rounded-3xl border border-primary/25 p-5 shadow-[0_0_60px_-30px_rgba(110,231,255,0.5)] sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={20} className="text-primary" />
                  <h2 className="text-lg font-bold text-text">{t("merchant.cart")}</h2>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-red-400 transition"
                  >
                    {t("merchant.clearCart")}
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
                  <ShoppingCart size={32} className="text-text-muted" />
                  <p className="mt-4 text-sm text-text-secondary">{t("merchant.emptyCart")}</p>
                  <p className="mt-1 text-xs text-text-muted">{t("merchant.tapToAdd")}</p>
                </div>
              ) : (
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{item.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {formatAmount(item.priceUSDC)}
                          {" × "}
                          {item.qty}
                          {" = "}
                          <span className="text-primary font-bold">
                            {formatAmount(item.priceUSDC * item.qty)}
                          </span>
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-bg text-text-secondary hover:text-text"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-text">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-bg text-text-secondary hover:text-text"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-text-muted hover:text-red-400"
                          aria-label={t("merchant.removeItem")}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-1 flex items-center justify-between text-sm text-text-secondary">
                  <span>{t("merchant.subtotal")}</span>
                  <span className="font-mono">{formatAmount(totalUSDC)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-text">{t("merchant.total")}</span>
                  <div className="text-right">
                    <span className="block text-2xl font-black text-primary">{formatAmount(totalUSDC)}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {mode === "IDR" ? `${totalUSDC.toFixed(2)} USDC` : `Rp ${totalIDR.toLocaleString("id-ID")}`}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-text-muted">{t("merchant.rateNote")}</p>
              </div>

              <div className="mt-5">
                {connected ? (
                  cart.length > 0 ? (
                    <Link
                      href={generatePaymentLink()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-bg transition hover:brightness-110"
                    >
                      <QrCode size={18} />
                      {t("merchant.generateQR")}
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-2xl border border-border bg-bg px-5 py-4 text-sm font-bold text-text-muted"
                    >
                      {t("merchant.emptyCart")}
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => connect("metamask")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-4 text-sm font-bold text-primary transition hover:bg-primary/20"
                  >
                    <Wallet size={18} />
                    {t("merchant.connectFirst")}
                  </button>
                )}
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-text-muted">
                  <Lock size={12} />
                  {t("merchant.footerHint")}
                </p>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="mt-8">
            <Link
              href="/payment"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary transition hover:border-primary/50 hover:text-text"
            >
              <ArrowLeft size={14} />
              {t("merchant.backToPayment")}
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
