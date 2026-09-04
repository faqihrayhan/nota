import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidSignature } from "@/lib/auth/message";
import { signWalletJwt } from "@/lib/auth/jwt";
import { ARC_TESTNET_CHAIN_ID_DEC } from "@/lib/arc-chain";

/**
 * POST /api/auth/wallet
 * Body: { address, message, signature }
 *
 * Verifies the SIWE-style signed message and exchanges it for a short-lived
 * JWT carrying the wallet address as a custom claim. RLS policies read this
 * claim via `auth.jwt() -> 'wallet_address'` to scope rows per wallet.
 *
 * Security checks:
 * 1. message must be one we issued (domain prefix + nonce that exists & unexpired)
 * 2. message must not have been used before (one-time nonce)
 * 3. signature must verify against the claimed address
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY (server-only): `auth_nonces` is RLS
 * deny-all for client keys; only the service role may look up / burn nonces.
 */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      address?: string;
      message?: string;
      signature?: string;
    };

    const address = (body.address ?? "").trim().toLowerCase();
    const message = (body.message ?? "").trim();
    const signature = (body.signature ?? "").trim();

    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      return NextResponse.json({ error: "invalid_address" }, { status: 400 });
    }
    if (!message || !signature) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Service-role key: auth_nonces is RLS deny-all for anon/authenticated.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "supabase_not_configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    // Parse nonce + expiration from the signed message itself.
    const nonceMatch = message.match(/^Nonce: (.+)$/m);
    const expMatch = message.match(/^Expiration Time: (.+)$/m);
    const chainMatch = message.match(/^Chain ID: (\d+)$/m);
    if (!nonceMatch || !expMatch || !chainMatch) {
      return NextResponse.json({ error: "malformed_message" }, { status: 400 });
    }
    const nonce = nonceMatch[1];
    const expirationTime = expMatch[1];
    const chainId = parseInt(chainMatch[1], 10);

    if (chainId !== ARC_TESTNET_CHAIN_ID_DEC) {
      return NextResponse.json({ error: "wrong_chain" }, { status: 400 });
    }
    if (new Date(expirationTime).getTime() < Date.now()) {
      return NextResponse.json({ error: "nonce_expired" }, { status: 401 });
    }

    // The message must carry the address it claims to be for.
    if (!message.includes(address)) {
      return NextResponse.json({ error: "address_mismatch" }, { status: 400 });
    }

    // Look up the nonce — must exist, be for this address, and be unexpired.
    const { data: nonceRow, error: nonceErr } = await supabase
      .from("auth_nonces")
      .select("nonce, expires_at")
      .eq("nonce", nonce)
      .eq("wallet_address", address)
      .maybeSingle();

    if (nonceErr) {
      console.error("wallet: nonce lookup failed", nonceErr);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (!nonceRow) {
      return NextResponse.json({ error: "invalid_nonce" }, { status: 401 });
    }
    if (new Date(nonceRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "nonce_expired" }, { status: 401 });
    }

    // Burn the nonce (one-time use) BEFORE verifying the signature to prevent
    // replay even if verification is slow.
    await supabase.from("auth_nonces").delete().eq("nonce", nonce);

    // Verify the signature cryptographically.
    const ok = await isValidSignature(message, signature, address);
    if (!ok) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    // Issue the JWT with the wallet address as a custom claim.
    const token = await signWalletJwt(address);
    return NextResponse.json({ token });
  } catch (err) {
    console.error("wallet: unexpected error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
