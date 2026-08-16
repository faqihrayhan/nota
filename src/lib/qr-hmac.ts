import { keccak256Hex } from "./invoice-manager";

// Shared secret for HMAC QR verification (can be configured via env or fallback)
const QR_SECRET = process.env.NEXT_PUBLIC_QR_HMAC_SECRET || "nota-qr-hmac-secret-v1";

export interface QRPayload {
  payerAddress: string;
  totalAmount: string;
  items: { name: string; price: number }[];
  category: string;
  splitId?: number; // Present for split_bill: on-chain split ID to pay via paySplit()
  timestamp: number;
  expiresAt: number;
  nonce: string;
  hmac?: string; // Optional HMAC signature for anti-tamper
}

/**
 * Computes a deterministic HMAC-like hash for a QR payload using keccak256
 */
export async function computeQRHmac(payload: Omit<QRPayload, "hmac">): Promise<string> {
  // Canonical string representation of payload critical fields
  const canonicalString = `${payload.payerAddress.toLowerCase()}:${payload.totalAmount}:${payload.nonce}:${payload.timestamp}:${payload.expiresAt}:${QR_SECRET}`;
  return await keccak256Hex(canonicalString);
}

/**
 * Encodes a QR payload object to base64 with auto-generated HMAC signature
 */
export async function encodeQRPayload(payload: Omit<QRPayload, "hmac">): Promise<string> {
  const hmac = await computeQRHmac(payload);
  const fullPayload: QRPayload = { ...payload, hmac };
  return btoa(JSON.stringify(fullPayload));
}

/**
 * Decodes and verifies a base64 QR payload string.
 * Returns decoded payload and verification status.
 */
export async function decodeAndVerifyQR(raw: string): Promise<{
  payload: QRPayload | null;
  isValidSignature: boolean;
  isLegacyUnsigned: boolean;
}> {
  try {
    const jsonString = atob(raw.trim());
    const parsed = JSON.parse(jsonString) as QRPayload;

    if (!parsed || typeof parsed !== "object" || !parsed.totalAmount || !parsed.nonce) {
      return { payload: null, isValidSignature: false, isLegacyUnsigned: false };
    }

    if (!parsed.hmac) {
      // Legacy QR code created before HMAC feature
      return { payload: parsed, isValidSignature: false, isLegacyUnsigned: true };
    }

    const { hmac, ...dataWithoutHmac } = parsed;
    const expectedHmac = await computeQRHmac(dataWithoutHmac);

    return {
      payload: parsed,
      isValidSignature: hmac === expectedHmac,
      isLegacyUnsigned: false,
    };
  } catch {
    return { payload: null, isValidSignature: false, isLegacyUnsigned: false };
  }
}
