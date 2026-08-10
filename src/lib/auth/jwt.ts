import { SignJWT, jwtVerify } from "jose";

/**
 * Wallet-auth JWT helpers (Phase 5 — Payment Hardening).
 *
 * The JWT is signed with the Supabase JWT secret so that RLS policies can read
 * it via `auth.jwt()`. The token carries the wallet address as a custom claim
 * (`wallet_address`), which RLS compares against row-level `wallet_address`.
 *
 * SECURITY NOTES:
 * - `SUPABASE_JWT_SECRET` must be set in .env (server-only; NEVER expose to client).
 *   Find it in Supabase Dashboard → Project Settings → API → JWT Secret.
 * - We use HS256 (the same algorithm Supabase uses for its own JWTs) so that
 *   RLS `auth.jwt()` and the Supabase API accept our tokens.
 */

const SECRET_ENV = "SUPABASE_JWT_SECRET";

const AUDIENCE = "supabase"; // Supabase expects `aud: "supabase"` in its JWTs

function getSecret(): Uint8Array {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    throw new Error(
      `${SECRET_ENV} is not set. Add it to .env (from Supabase Dashboard → Settings → API → JWT Secret).`
    );
  }
  return new TextEncoder().encode(secret);
}

export type WalletClaims = {
  /** EIP-55 checksummed wallet address that signed the auth message. */
  wallet_address: string;
};

export type WalletJwtPayload = WalletClaims & {
  sub: string;
  role: string;
  aud: string;
  iat: number;
  exp: number;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Issue a signed JWT for a wallet address.
 * `sub` is the lowercase address; `wallet_address` keeps the checksummed form.
 */
export async function signWalletJwt(
  walletAddress: string
): Promise<string> {
  const lower = walletAddress.toLowerCase();
  return new SignJWT({
    wallet_address: walletAddress, // checksummed form (as signed)
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(lower)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .setAudience(AUDIENCE)
    .sign(getSecret());
}

/**
 * Verify a wallet JWT. Returns the payload on success, throws on invalid/expired.
 */
export async function verifyWalletJwt(
  token: string
): Promise<WalletJwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    audience: AUDIENCE,
  });
  return payload as WalletJwtPayload;
}
