"use client";

import { buildAuthMessage, AUTH_MESSAGE_VERSION } from "@/lib/auth/message";
import { ARC_TESTNET_CHAIN_ID_DEC } from "@/lib/arc-chain";
import { setAuthToken, clearAuthToken } from "@/lib/supabase";
import type { EipProvider } from "@/context/WalletContext";

/**
 * Client-side wallet sign-in flow (Phase 5 — Payment Hardening).
 *
 * 1. GET a fresh nonce from /api/auth/challenge
 * 2. Build the SIWE-style message, ask the wallet to `personal_sign` it
 * 3. POST (address, message, signature) to /api/auth/wallet → JWT
 * 4. Store the JWT; Supabase queries attach it as Bearer for RLS
 */

type ChallengeResponse = {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export type SignInErrorCode =
  | "no_provider"
  | "rejected"
  | "network"
  | "server"
  | "invalid_signature";

export class SignInError extends Error {
  code: SignInErrorCode;
  constructor(code: SignInErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

async function fetchChallenge(address: string): Promise<ChallengeResponse> {
  const res = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new SignInError("server", "challenge_failed");
  return (await res.json()) as ChallengeResponse;
}

/**
 * Ask the wallet to sign the auth message and exchange it for a JWT.
 * Returns the JWT on success. Throws SignInError on failure.
 */
export async function signInWithWallet(
  provider: EipProvider,
  address: string
): Promise<string> {
  const domain =
    typeof window !== "undefined" ? window.location.host : "localhost:3000";

  const { nonce, issuedAt, expirationTime } = await fetchChallenge(address);

  const message = buildAuthMessage({
    domain,
    address,
    nonce,
    issuedAt,
    expirationTime,
    chainId: ARC_TESTNET_CHAIN_ID_DEC,
  });

  let signature: string;
  try {
    signature = (await provider.request({
      method: "personal_sign",
      params: [message, address],
    })) as string;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4001) {
      throw new SignInError("rejected", "user_rejected_signature");
    }
    throw new SignInError("network", "sign_failed");
  }

  const res = await fetch("/api/auth/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, message, signature }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "invalid_signature") {
      throw new SignInError("invalid_signature", body.error);
    }
    throw new SignInError("server", body.error ?? "auth_failed");
  }

  const { token } = (await res.json()) as { token: string };
  setAuthToken(token);
  return token;
}

/** Sign out — clears the stored JWT. */
export function signOutWallet(): void {
  clearAuthToken();
}

export { AUTH_MESSAGE_VERSION };
