// Exchange-rate module for IDR ⇄ USDC conversions.
//
// Per docs.arc.io guidance, production apps should pull real fiat↔stablecoin
// prices instead of hardcoding a static rate. Arc's App Kit Swap + oracle
// providers (Chainlink / Pyth / Chronicle) are the onchain route; for a
// client-side dApp the pragmatic approach is a lightweight offchain price
// source (e.g. CoinGecko) with a configurable fallback rate so the UI never
// breaks when the network is unavailable.
//
// All rates are "IDR per 1 USDC" (≈ 16,000-16,400 in July 2026).

export const DEFAULT_IDR_PER_USDC = 16200;

export interface ExchangeRate {
  idrPerUsdc: number;
  source: "coingecko" | "fallback";
  updatedAt: number;
}

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=idr";

// Cache the last successful rate so repeated renders don't refetch.
let cached: ExchangeRate | null = null;

/**
 * Fetch the live IDR⇄USDC rate from CoinGecko.
 * Falls back to DEFAULT_IDR_PER_USDC on any error (network, rate limit, etc.)
 * and always resolves — never throws.
 */
export async function fetchExchangeRate(): Promise<ExchangeRate> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(COINGECKO_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = (await res.json()) as { "usd-coin"?: { idr?: number } };
    const idr = data["usd-coin"]?.idr;
    if (typeof idr !== "number" || !isFinite(idr) || idr <= 0) {
      throw new Error("Bad rate payload");
    }
    cached = { idrPerUsdc: idr, source: "coingecko", updatedAt: Date.now() };
  } catch {
    cached = {
      idrPerUsdc: DEFAULT_IDR_PER_USDC,
      source: "fallback",
      updatedAt: Date.now(),
    };
  }
  return cached;
}

/** Synchronous getter — returns the cached rate or the default. */
export function getCachedRate(): ExchangeRate {
  return (
    cached ?? {
      idrPerUsdc: DEFAULT_IDR_PER_USDC,
      source: "fallback",
      updatedAt: Date.now(),
    }
  );
}

export const formatIDR = (num: number) => `Rp ${num.toLocaleString("id-ID")}`;

export const formatUSDC = (num: number) =>
  `${num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;

/** Convert IDR → USDC using the given rate. */
export const idrToUsdc = (idr: number, rate: number) => idr / rate;

/** Convert USDC → IDR using the given rate. */
export const usdcToIdr = (usdc: number, rate: number) => usdc * rate;
