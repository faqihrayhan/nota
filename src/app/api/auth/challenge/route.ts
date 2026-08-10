import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/challenge
 * Body: { address: string }
 *
 * Issues a one-time sign-in nonce (SIWE-style) tied to the wallet address.
 * The nonce is stored in the `auth_nonces` table and expires after 5 minutes.
 *
 * The client then builds the sign-in message, asks the wallet to sign it,
 * and exchanges (message, signature) for a JWT at /api/auth/wallet.
 */

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateNonce(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { address?: string };
    const raw = body.address?.trim().toLowerCase() ?? "";
    if (!/^0x[0-9a-f]{40}$/.test(raw)) {
      return NextResponse.json({ error: "invalid_address" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "supabase_not_configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const nonce = generateNonce();
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + NONCE_TTL_MS).toISOString();

    const { error } = await supabase.from("auth_nonces").insert({
      wallet_address: raw,
      nonce,
      issued_at: issuedAt,
      expires_at: expirationTime,
    });

    if (error) {
      console.error("challenge: insert nonce failed", error);
      return NextResponse.json({ error: "nonce_store_failed" }, { status: 500 });
    }

    return NextResponse.json({ nonce, issuedAt, expirationTime });
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
