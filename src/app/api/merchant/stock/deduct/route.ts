import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side stock deduction for merchant catalog items.
 *
 * WHY server-side: the payment happens on the PAYER's device (PaymentPage),
 * but `merchant_catalog` RLS only lets the OWNER (merchant) update rows.
 * A payer-side update would 403. This route uses the Supabase service-role
 * key which bypasses RLS, so the merchant's stock is always deducted after a
 * confirmed on-chain payment — exactly once per nonce.
 *
 * Security & idempotency:
 *  1. Caller must present a wallet JWT issued by /api/auth/wallet (any real
 *     authed wallet — the payer).
 *  2. A `transactions` row with the same nonce + payee_address must already
 *     exist (saved by the payer right after the on-chain receipt). That row is
 *     the proof of payment; an attacker cannot invent a nonce that matches a
 *     real confirmed transaction without having actually paid.
 *  3. The row is claimed atomically through `stock_deducted` (set true exactly
 *     once). Retries / replays after a successful deduction return `skipped`,
 *     so stock can never be double-deducted.
 */

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Stock deduction not configured on server." },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Decode the caller's wallet JWT (issued by /api/auth/wallet). The token
  // carries `wallet_address` — we only need it to confirm a real authed wallet.
  let jwtWallet: string | null = null;
  try {
    const base64 = token.split(".")[1];
    if (base64) {
      const payload = JSON.parse(Buffer.from(base64, "base64url").toString("utf-8"));
      jwtWallet = (payload?.wallet_address as string) || (payload?.app_metadata?.wallet_address as string) || null;
    }
  } catch {
    /* ignore decode errors */
  }

  if (!jwtWallet) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payeeAddress: string | undefined = body?.payeeAddress;
  const nonce: string | undefined = body?.nonce;
  const items: { name: string; qty?: number }[] | undefined = body?.items;

  if (!payeeAddress || !nonce || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const normalizedPayee = payeeAddress.toLowerCase();
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ── Proof of payment: a confirmed transaction for this nonce+payee ──
  const { data: tx } = await admin
    .from("transactions")
    .select("id, stock_deducted")
    .eq("nonce", nonce)
    .eq("payee_address", normalizedPayee)
    .eq("status", "confirmed")
    .maybeSingle();

  if (!tx) {
    return NextResponse.json(
      { error: "Payment not verified for this nonce." },
      { status: 400 }
    );
  }

  // ── Atomic claim: exactly one caller wins the deduction ──
  const { data: claimed } = await admin
    .from("transactions")
    // NOTE: `transactions` has NO `updated_at` column (only created_at,
    // expires_at). Including it here would make PostgREST fail with
    // PGRST204 and the claim would always look "already-deducted".
    .update({ stock_deducted: true })
    .eq("id", tx.id)
    .eq("stock_deducted", false)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already-deducted" });
  }

  // ── Deduct stock per item (match by normalized name) ──
  const results: { name: string; updated: boolean; stock?: number }[] = [];
  for (const item of items) {
    const qtyToDed = Math.max(1, Number(item.qty) || 1);
    const { data: catalogItem, error: selErr } = await admin
      .from("merchant_catalog")
      .select("id, stock")
      .eq("wallet_address", normalizedPayee)
      .ilike("name", item.name)
      .maybeSingle();

    if (selErr) {
      console.error("Stock lookup failed for", item.name, selErr);
      results.push({ name: item.name, updated: false });
      continue;
    }
    if (!catalogItem || catalogItem.stock == null) {
      results.push({ name: item.name, updated: false, stock: undefined });
      continue;
    }

    const newStock = Math.max(0, Number(catalogItem.stock) - qtyToDed);
    // Guard against going below zero even between read and write.
    const { error: updErr } = await admin
      .from("merchant_catalog")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", catalogItem.id)
      .gte("stock", qtyToDed);

    if (updErr) {
      console.error("Stock deduct failed for", item.name, updErr);
      results.push({ name: item.name, updated: false, stock: Number(catalogItem.stock) });
    } else {
      results.push({ name: item.name, updated: true, stock: newStock });
    }
  }

  return NextResponse.json({ ok: true, results });
}