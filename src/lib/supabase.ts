import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factory (Phase 5 — Payment Hardening).
 *
 * Instead of one global anon client, we now create clients on demand so we
 * can attach the wallet JWT as the Bearer token. RLS policies on
 * `transactions` / `merchant_catalog` / `merchant_cart` read the JWT claim
 * (`wallet_address`) to scope rows per wallet.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase credentials required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

/** Create a Supabase client. Pass a JWT to authenticate as a wallet. */
export function createSupabaseClient(token?: string | null): SupabaseClient {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // supabaseUrl/supabaseKey are guaranteed set by the module-level check above.
  return createClient(supabaseUrl!, supabaseKey!, { global: { headers } });
}

// ─── Wallet auth token (Phase 5) ─────────────────────────────

const AUTH_TOKEN_KEY = "arc-nota:auth-token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

/** Client bound to the current wallet JWT (or anon if no token). */
export function getAuthedClient(): SupabaseClient {
  return createSupabaseClient(getAuthToken());
}

// ─── Types ───────────────────────────────────────────────────

export type Transaction = {
  id: string;
  wallet_address: string;
  payer_address: string;
  payee_address: string;
  amount: number;
  category: string;
  items: { name: string; price: number; qty?: number }[];
  tx_hash: string;
  block_hash: string;
  block_number: number;
  status: "pending" | "confirmed" | "failed";
  mode: "payment" | "receive";
  created_at: string;
  expires_at?: string;
  nonce?: string;
};

export type CatalogItem = {
  id: string;
  wallet_address: string;
  name: string;
  price_usdc: number;
  sku?: string;
  stock?: number;
  batch_no?: string;
  attributes?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  id: string;
  wallet_address: string;
  item_name: string;
  qty: number;
  price_usdc: number;
  catalog_id?: string;
  batch_no?: string;
  attributes?: Record<string, any>;
  added_at: string;
};

// ─── Catalog ─────────────────────────────────────────────────

export async function getCatalog(walletAddress: string): Promise<CatalogItem[]> {
  const { data, error } = await getAuthedClient()
    .from("merchant_catalog")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addCatalogItem(
  walletAddress: string,
  name: string,
  priceUsdc: number,
  options?: { sku?: string; stock?: number; batch_no?: string; attributes?: Record<string, any> }
): Promise<CatalogItem> {
  const { data, error } = await getAuthedClient()
    .from("merchant_catalog")
    .insert({
      wallet_address: walletAddress.toLowerCase(),
      name,
      price_usdc: priceUsdc,
      sku: options?.sku,
      stock: options?.stock ?? 0,
      batch_no: options?.batch_no,
      attributes: options?.attributes || {},
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCatalogItem(
  id: string,
  name: string,
  priceUsdc: number,
  options?: { sku?: string; stock?: number; batch_no?: string; attributes?: Record<string, any> }
): Promise<void> {
  const { error } = await getAuthedClient()
    .from("merchant_catalog")
    .update({
      name,
      price_usdc: priceUsdc,
      sku: options?.sku,
      stock: options?.stock,
      batch_no: options?.batch_no,
      attributes: options?.attributes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const { error } = await getAuthedClient().from("merchant_catalog").delete().eq("id", id);
  if (error) throw error;
}

export async function deductStockAfterPayment(
  merchantAddress: string,
  items: { name: string; price: number; qty?: number }[]
): Promise<void> {
  const client = getAuthedClient();
  const normalizedMerchant = merchantAddress.toLowerCase();

  for (const item of items) {
    const qtyToDed = item.qty || 1;
    const { data: catalogItem } = await client
      .from("merchant_catalog")
      .select("id, stock")
      .eq("wallet_address", normalizedMerchant)
      .ilike("name", item.name)
      .maybeSingle();

    if (catalogItem && catalogItem.stock != null) {
      const newStock = Math.max(0, Number(catalogItem.stock) - qtyToDed);
      await client
        .from("merchant_catalog")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", catalogItem.id);
    }
  }
}

// ─── Cart ────────────────────────────────────────────────────

export async function getCart(walletAddress: string): Promise<CartItem[]> {
  const { data, error } = await getAuthedClient()
    .from("merchant_cart")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("added_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addToCart(
  walletAddress: string,
  itemName: string,
  qty: number,
  priceUsdc: number
): Promise<CartItem> {
  // Check if item already exists in cart
  const existing = await getAuthedClient()
    .from("merchant_cart")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .eq("item_name", itemName)
    .maybeSingle();

  if (existing.data) {
    // Update qty
    const { error } = await getAuthedClient()
      .from("merchant_cart")
      .update({ qty: existing.data.qty + qty })
      .eq("id", existing.data.id);
    if (error) throw error;
    return { ...existing.data, qty: existing.data.qty + qty };
  }

  // Insert new
  const { data, error } = await getAuthedClient()
    .from("merchant_cart")
    .insert({
      wallet_address: walletAddress.toLowerCase(),
      item_name: itemName,
      qty,
      price_usdc: priceUsdc,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCartItemQty(id: string, qty: number): Promise<void> {
  if (qty <= 0) {
    await removeFromCart(id);
    return;
  }
  const { error } = await getAuthedClient()
    .from("merchant_cart")
    .update({ qty })
    .eq("id", id);
  if (error) throw error;
}

export async function removeFromCart(id: string): Promise<void> {
  const { error } = await getAuthedClient().from("merchant_cart").delete().eq("id", id);
  if (error) throw error;
}

export async function clearCart(walletAddress: string): Promise<void> {
  const { error } = await getAuthedClient()
    .from("merchant_cart")
    .delete()
    .eq("wallet_address", walletAddress.toLowerCase());
  if (error) throw error;
}

// ─── Transactions ────────────────────────────────────────────

export async function getTransactions(
  walletAddress: string,
  limit = 50
): Promise<Transaction[]> {
  const { data, error } = await getAuthedClient()
    .from("transactions")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function saveTransaction(tx: Omit<Transaction, "id" | "created_at">): Promise<Transaction> {
  const { data, error } = await getAuthedClient()
    .from("transactions")
    .insert({
      ...tx,
      wallet_address: tx.wallet_address.toLowerCase(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getIncomingTransactions(
  payeeAddress: string,
  limit = 50
): Promise<Transaction[]> {
  const { data, error } = await getAuthedClient()
    .from("transactions")
    .select("*")
    .eq("payee_address", payeeAddress.toLowerCase())
    .gt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export interface MerchantInflowStats {
  totalRevenueUsdc: number;
  todayRevenueUsdc: number;
  totalTransactionsCount: number;
  topSellingItems: { name: string; count: number; totalUsdc: number }[];
}

export async function getMerchantInflowStats(
  payeeAddress: string
): Promise<MerchantInflowStats> {
  const txs = await getIncomingTransactions(payeeAddress, 500);

  let totalRevenueUsdc = 0;
  let todayRevenueUsdc = 0;
  const itemMap = new Map<string, { count: number; totalUsdc: number }>();

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const tx of txs) {
    const txAmount = Number(tx.amount) || 0;
    totalRevenueUsdc += txAmount;

    if (tx.created_at && tx.created_at.startsWith(todayStr)) {
      todayRevenueUsdc += txAmount;
    }

    if (Array.isArray(tx.items)) {
      for (const item of tx.items) {
        if (!item || !item.name) continue;
        const qty = typeof item.qty === "number" && item.qty > 0 ? item.qty : 1;
        const current = itemMap.get(item.name) || { count: 0, totalUsdc: 0 };
        const itemPrice = typeof item.price === "number" ? (item.price > 1000 ? item.price / 1_000_000 : item.price) : 0;
        itemMap.set(item.name, {
          count: current.count + qty,
          totalUsdc: current.totalUsdc + itemPrice * qty,
        });
      }
    }
  }

  const topSellingItems = Array.from(itemMap.entries())
    .map(([name, stat]) => ({ name, ...stat }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRevenueUsdc,
    todayRevenueUsdc,
    totalTransactionsCount: txs.length,
    topSellingItems,
  };
}

export async function findTransactionByNonce(
  nonce: string
): Promise<Transaction | null> {
  const { data, error } = await getAuthedClient()
    .from("transactions")
    .select("*")
    .eq("nonce", nonce)
    .maybeSingle();
  if (error) return null;
  return data;
}

export function subscribeToTransactions(onInsert: () => void): () => void {
  const channel = getAuthedClient()
    .channel("transactions-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "transactions" },
      onInsert
    )
    .subscribe();
  return () => {
    getAuthedClient().removeChannel(channel);
  };
}
