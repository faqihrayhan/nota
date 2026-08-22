import { verifyMessage, type Hex } from "viem";

/**
 * SIWE-style sign-in message for Nota wallet auth (Phase 5).
 *
 * We use the EIP-4361-ish format (Sign-In with Ethereum) but scoped to our
 * own domain/version — NOT the full SIWE spec — because we only need
 * signature verification, not the whole SIWE registry flow.
 *
 * The message is constructed in a canonical, non-ambiguous format so the
 * wallet shows the user exactly what they are signing.
 */

export const AUTH_MESSAGE_VERSION = "1";

export type AuthMessageParams = {
  domain: string; // e.g. "mynota-delta.vercel.app" or "localhost:3000"
  address: string; // checksummed or lowercase; we normalize
  nonce: string; // random 8-char alphanumeric, stored server-side
  issuedAt: string; // ISO timestamp
  expirationTime: string; // ISO timestamp
  chainId: number; // Arc Testnet = 5042002
};

export function buildAuthMessage({
  domain,
  address,
  nonce,
  issuedAt,
  expirationTime,
  chainId,
}: AuthMessageParams): string {
  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    ``,
    `Sign in to Nota (on-chain payment & receipt app).`,
    ``,
    `URI: https://${domain}/`,
    `Version: ${AUTH_MESSAGE_VERSION}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ];
  return lines.join("\n");
}

/**
 * Verify that `signature` is a valid EIP-191 personal_sign of `message` by
 * `expectedAddress` (case-insensitive). Returns true/false — never throws.
 */
export async function isValidSignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    const recovered = await verifyMessage({
      message,
      signature: signature as Hex,
      address: expectedAddress as Hex,
    });
    return recovered;
  } catch {
    return false;
  }
}

/** Basic shape guard — messages must follow the SIWE format prefix. */
export function isOurAuthMessage(message: string): boolean {
  return message.includes("wants you to sign in with your Ethereum account:");
}
