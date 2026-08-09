"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getCatalog,
  addCatalogItem,
  deleteCatalogItem,
  getCart,
  addToCart,
  updateCartItemQty,
  removeFromCart,
  clearCart,
  saveTransaction,
  getTransactions,
  type CatalogItem,
  type CartItem,
  type Transaction,
} from "@/lib/supabase";
import { ARC_EXPLORER_URL } from "@/lib/arc-chain";
import { cn } from "@/lib/utils";
import {
  Store,
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
  Receipt,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// Simulasi kurs IDR → USDC (sama seperti yang dipakai di cart sekarang)
const IDR_TO_USDC_RATE = 16200;

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

  // Catalog state
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);

  // QR state
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrTotal, setQrTotal] = useState(0);
  const [qrNonce, setQrNonce] = useState("");
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [error, setError] = useState("");

  // History state
  const [history, setHistory] = useState<Transaction[]>([]);

  // Load data on wallet connect
  useEffect(() => {
    if (!address) return;
    loadCatalog();
    loadCart();
    loadHistory();
  }, [address]);

  async function loadCatalog() {
    if (!address) return;
    setCatalogLoading(true);
    try {
      const items = await getCatalog(address);
      setCatalog(items);
    } catch (err) {
      console.error("Failed to load catalog:", err);
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

  // Cart calculations
  const cartTotalIDR = cart.reduce((sum, item) => sum + item.price_idr * item.qty, 0);
  const cartTotalUSDC = cartTotalIDR / IDR_TO_USDC_RATE;

  // Add item to catalog
  async function handleAddToCatalog(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !newItemName.trim() || !newItemPrice.trim()) return;
    try {
      await addCatalogItem(address, newItemName.trim(), parseFloat(newItemPrice));
      setNewItemName("");
      setNewItemPrice("");
      await loadCatalog();
    } catch (err) {
      setError("Failed to add item to catalog");
      console.error(err);
    }
  }

// Add item from catalog to cart
  async function handleAddToCart(item: CatalogItem) {
    if (!address) return;
    try {
      await addToCart(address, item.name, 1, item.price_idr);
      await loadCart();
    } catch (err) {
      setError("Failed to add to cart");
      console.error(err);
    }
  }

  // Update cart quantity
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

  // Remove from cart
  async function handleRemoveFromCart(id: string) {
    try {
      await removeFromCart(id);
      await loadCart();
    } catch (err) {
      console.error(err);
    }
  }

  // Generate QR from cart
  function handleGenerateQR() {
    if (cart.length === 0) return;
    const nonce = generateNonce();
    const totalUsdc = cartTotalUSDC.toFixed(6);
    const itemsForQR = cart.map((item) => ({
      name: item.item_name,
      price: item.price_idr / IDR_TO_USDC_RATE,
    }));

    const qrPayload = {
      payerAddress: address, // Payer = merchant (yang generate QR)
      totalAmount: (parseFloat(totalUsdc) * 1_000_000).toFixed(0), // in 6 decimals
      items: itemsForQR,
      category: "belanja",
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 menit
      nonce,
    };

    const encoded = encodeQR(qrPayload);
    setQrData(encoded);
    setQrNonce(nonce);
    setError("");
  }

  // Simulate payment received (in real app, this would be from webhook/on-chain listener)
  async function handleSimulatePayment() {
    if (!address || !qrData) return;
    try {
      const tx: Omit<Transaction, "id" | "created_at"> = {
        wallet_address: address.toLowerCase(),
        payer_address: address.toLowerCase(),
        payee_address: address.toLowerCase(),
        amount: qrTotal,
        category: "belanja",
        items: cart.map((c) => ({ name: c.item_name, price: c.price_idr / IDR_TO_USDC_RATE })),
        tx_hash: `0xsimulated${Date.now()}`,
        block_hash: `0xsimulated${Date.now()}`,
        block_number: 0,
        status: "confirmed",
        mode: "receive",
        nonce: qrNonce,
      };
      await saveTransaction(tx);
      setSuccessTx(tx as Transaction);
      setQrData(null);
      await clearCart(address);
      await loadCart();
      await loadHistory();
    } catch (err) {
      setError("Failed to record transaction");
      console.error(err);
    }
  }

  if (!address) {
    return (
      <section className="relative mx-auto max-w-4xl px-5 py-24">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-line/40 bg-ink-2/30 p-12 text-center">
          <Wallet className="h-12 w-12 text-text-muted" />
          <h2 className="mt-4 font-display text-xl font-semibold">Connect Wallet First</h2>
          <p className="mt-2 text-sm text-text-muted">Connect your wallet to access POS features.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto max-w-4xl px-5 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-line/40 bg-ink-2/50 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">
          <Store className="h-3 w-3" />
          Merchant POS
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Point of Sale</h1>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-warn-amber/40 bg-warn-amber/10 px-4 py-3 text-sm text-warn-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Catalog */}
        <div className="space-y-6">
<div className="rounded-2xl border border-ink-line/40 bg-ink-2/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-accent" />
              <h3 className="font-display text-sm font-semibold">Product Catalog</h3>
            </div>

            {/* Add new item form */}
            <form onSubmit={handleAddToCatalog} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name"
                className="flex-1 rounded-xl border border-ink-line/40 bg-ink px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <input
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price IDR"
                min="0"
                step="1000"
                className="w-28 rounded-xl border border-ink-line/40 bg-ink px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent px-3 py-2 text-sm text-white hover:bg-accent-strong transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>

            {/* Catalog list */}
            {catalogLoading ? (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : catalog.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No items in catalog yet.</p>
            ) : (
              <div className="space-y-2">
                {catalog.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-ink-line/30 bg-ink p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-text-muted">Rp {item.price_idr.toLocaleString("id-ID")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all"
                      >
                        <ShoppingCart className="h-3 w-3 inline mr-1" />
                        Add
                      </button>
                      <button
                        onClick={() => deleteCatalogItem(item.id).then(loadCatalog)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart & Checkout */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-ink-line/40 bg-ink-2/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-4 w-4 text-accent" />
              <h3 className="font-display text-sm font-semibold">Cart</h3>
            </div>

            {cartLoading ? (
              <div className="flex items-center justify-center py-8 text-text-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : cart.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">Cart is empty.</p>
            ) : (
<div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-ink-line/30 bg-ink p-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.item_name}</p>
                      <p className="text-xs text-text-muted">
                        Rp {item.price_idr.toLocaleString("id-ID")} × {item.qty} = Rp{" "}
                        {(item.price_idr * item.qty).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQty(item, -1)}
                        className="rounded-lg border border-ink-line/40 p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="text-sm w-6 text-center">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(item, 1)}
                        className="rounded-lg border border-ink-line/40 p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cart totals */}
            <div className="border-t border-ink-line/30 pt-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-muted">Subtotal</span>
                <span>Rp {cartTotalIDR.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Total (USDC)</span>
                <span className="font-semibold">{cartTotalUSDC.toFixed(2)} USDC</span>
              </div>
            </div>

            {/* Generate QR button */}
            <button
              onClick={handleGenerateQR}
              disabled={cart.length === 0}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-all",
                "hover:bg-accent-strong hover:shadow-lg hover:shadow-accent/20",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              <Receipt className="h-4 w-4" />
              Generate QR
            </button>
          </div>

          {/* QR Display */}
          {qrData && (
            <div className="rounded-2xl border border-accent/40 bg-ink-2/30 p-6 text-center">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-accent">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Scan to Pay</span>
                </div>
                <button
                  onClick={() => setQrData(null)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-ink-line/40 hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex justify-center mb-4">
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG value={qrData} size={200} />
                </div>
              </div>

<p className="text-sm text-text-muted mb-2">Total: {cartTotalUSDC.toFixed(2)} USDC</p>
              <button
                onClick={() => { navigator.clipboard.writeText(qrData); }}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-line/40 px-3 py-1.5 text-xs text-text-muted hover:bg-ink-line/40 hover:text-text"
              >
                <Copy className="h-3 w-3" />
                Copy QR data
              </button>

              {/* Simulate payment (for testing) */}
              <div className="mt-4 pt-4 border-t border-ink-line/30">
                <p className="text-xs text-text-muted mb-2">For testing:</p>
                <button
                  onClick={handleSimulatePayment}
                  className="rounded-lg bg-stamp-green/10 px-4 py-2 text-sm font-medium text-stamp-green hover:bg-stamp-green/20 transition-all"
                >
                  Simulate Payment Received
                </button>
              </div>
            </div>
          )}

          {/* Success state */}
          {successTx && (
            <div className="rounded-2xl border border-stamp-green/40 bg-stamp-green/5 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-stamp-green mb-2" />
              <h3 className="font-display text-lg font-semibold">Payment Received!</h3>
              <p className="text-sm text-text-muted mt-1">
                {successTx.amount.toFixed(2)} USDC received
              </p>
              <a
                href={`${ARC_EXPLORER_URL}/tx/${successTx.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:text-accent-strong"
              >
                View on explorer <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => setSuccessTx(null)}
                className="mt-4 w-full rounded-xl border border-ink-line/40 px-4 py-2 text-sm text-text-muted hover:bg-ink-2 hover:text-text transition-all"
              >
                New Transaction
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      {history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-text-muted" />
            <h3 className="font-display text-sm font-semibold">Recent Transactions</h3>
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-ink-line/30 bg-ink p-4"
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
                  <p className="text-sm font-medium">{tx.amount.toFixed(2)} USDC</p>
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
  );
}
