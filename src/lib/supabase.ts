import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase credentials required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// transactions.id is TEXT (no DB-side default), so the client generates it.
// crypto.randomUUID() is available in all modern browsers + Node ≥ 19.
function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Types
export type Transaction = {
  id: string;
  wallet_address: string;
  payer_address: string;
  payee_address: string;
  amount: number;
  category: string;
  items: { name: string; price: number }[];
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
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  id: string;
  wallet_address: string;
  item_name: string;
  qty: number;
  price_usdc: number;
  added_at: string;
};

// ─── Catalog ────────────────────────────────────────────────

export async function getCatalog(walletAddress: string): Promise<CatalogItem[]> {
  const { data, error } = await supabase
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
  priceUsdc: number
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from("merchant_catalog")
    .insert({
      wallet_address: walletAddress.toLowerCase(),
      name,
      price_usdc: priceUsdc,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCatalogItem(
  id: string,
  name: string,
  priceUsdc: number
): Promise<void> {
  const { error } = await supabase
    .from("merchant_catalog")
    .update({ name, price_usdc: priceUsdc, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const { error } = await supabase.from("merchant_catalog").delete().eq("id", id);
  if (error) throw error;
}

// ─── Cart ───────────────────────────────────────────────────

export async function getCart(walletAddress: string): Promise<CartItem[]> {
  const { data, error } = await supabase
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
  const existing = await supabase
    .from("merchant_cart")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .eq("item_name", itemName)
    .maybeSingle();

  if (existing.data) {
    // Update qty
    const { error } = await supabase
      .from("merchant_cart")
      .update({ qty: existing.data.qty + qty })
      .eq("id", existing.data.id);
    if (error) throw error;
    return { ...existing.data, qty: existing.data.qty + qty };
  }

  // Insert new
  const { data, error } = await supabase
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
  const { error } = await supabase
    .from("merchant_cart")
    .update({ qty })
    .eq("id", id);
  if (error) throw error;
}

export async function removeFromCart(id: string): Promise<void> {
  const { error } = await supabase.from("merchant_cart").delete().eq("id", id);
  if (error) throw error;
}

export async function clearCart(walletAddress: string): Promise<void> {
  const { error } = await supabase
    .from("merchant_cart")
    .delete()
    .eq("wallet_address", walletAddress.toLowerCase());
  if (error) throw error;
}

// ─── Transactions ───────────────────────────────────────────

export async function getTransactions(
  walletAddress: string,
  limit = 50
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function saveTransaction(tx: Omit<Transaction, "id" | "created_at">): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      id: newId(),
      ...tx,
      wallet_address: tx.wallet_address.toLowerCase(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findTransactionByNonce(
  nonce: string
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("nonce", nonce)
    .maybeSingle();
  if (error) return null;
  return data;
}

export function subscribeToTransactions(onInsert: () => void): () => void {
  const channel = supabase
    .channel("transactions-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "transactions" },
      onInsert
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
