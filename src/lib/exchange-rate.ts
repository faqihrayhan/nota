// Exchange-rate module for multi-currency conversions (USDC, IDR, MYR, SGD).
// Uses CoinGecko for live IDR/USD, and cross rates for MYR and SGD.

export const DEFAULT_USDC_PER_USD = 1.0; 
export const DEFAULT_IDR_PER_USDC = 16200.0;

export const FALLBACK_RATES = {
  USDC: 1.0,
  IDR: 16200.0,
  MYR: 4.09,
  SGD: 1.28,
};

let cachedRates: { rates: Record<string, number>; source: "coingecko" | "fallback"; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export interface ExchangeRate {
  rate: number;
  idrPerUsdc: number;
  lastUpdated: string;
  source: string;
}

export interface LiveRatesResult {
  rates: Record<string, number>;
  source: "coingecko" | "fallback";
  lastUpdated: string;
}

/**
 * Fetch live exchange rates. Base currency is USD (which equals USDC).
 * Returns the source so callers can label "live" vs "estimate" truthfully.
 */
export async function fetchLiveRates(): Promise<LiveRatesResult> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < CACHE_TTL) {
    return {
      rates: cachedRates.rates,
      source: cachedRates.source,
      lastUpdated: new Date(cachedRates.timestamp).toISOString(),
    };
  }

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=idr,myr,sgd", {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error("CoinGecko API failed");
    const data = await res.json();

    if (data && data["usd-coin"] && data["usd-coin"].idr) {
      const rates = {
        USDC: 1.0,
        IDR: data["usd-coin"].idr || FALLBACK_RATES.IDR,
        MYR: data["usd-coin"].myr || FALLBACK_RATES.MYR,
        SGD: data["usd-coin"].sgd || FALLBACK_RATES.SGD,
      };
      cachedRates = { rates, source: "coingecko", timestamp: now };
      return { rates, source: "coingecko", lastUpdated: new Date(now).toISOString() };
    }
  } catch (err) {
    console.warn("Using fallback exchange rates due to network/API error:", err);
  }

  return {
    rates: FALLBACK_RATES,
    source: "fallback",
    lastUpdated: new Date().toISOString(),
  };
}

export async function fetchExchangeRate(): Promise<ExchangeRate> {
  const { rates, source, lastUpdated } = await fetchLiveRates();
  const idrRate = rates.IDR || DEFAULT_IDR_PER_USDC;
  return {
    rate: idrRate,
    idrPerUsdc: idrRate,
    lastUpdated,
    source,
  };
}

export function getCachedRate(): ExchangeRate {
  const idrRate = cachedRates?.rates?.IDR || DEFAULT_IDR_PER_USDC;
  return {
    rate: idrRate,
    idrPerUsdc: idrRate,
    lastUpdated: new Date().toISOString(),
    source: cachedRates?.source || "fallback",
  };
}

export type CurrencyCode = "USDC" | "IDR" | "MYR" | "SGD";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USDC: "USDC ",
  IDR: "Rp ",
  MYR: "RM ",
  SGD: "S$ ",
};

/**
 * Convert IDR → USDC using the given rate.
 */
export const idrToUsdc = (idr: number, rate: number = DEFAULT_IDR_PER_USDC) => idr / rate;

/**
 * Convert USDC → IDR using the given rate.
 */
export const usdcToIdr = (usdc: number, rate: number = DEFAULT_IDR_PER_USDC) => usdc * rate;

/**
 * Convert amount in USDC to target currency.
 */
export function convertFromUsdc(usdcAmount: number, targetCurrency: CurrencyCode, rates: Record<string, number>): number {
  const rate = rates[targetCurrency] ?? FALLBACK_RATES[targetCurrency] ?? 1.0;
  return usdcAmount * rate;
}

/**
 * Convert target currency amount back to USDC.
 */
export function convertToUsdc(amount: number, sourceCurrency: CurrencyCode, rates: Record<string, number>): number {
  const rate = rates[sourceCurrency] ?? FALLBACK_RATES[sourceCurrency] ?? 1.0;
  if (rate === 0) return 0;
  return amount / rate;
}

/**
 * Format currency nicely for display.
 */
export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  if (currency === "USDC") {
    return `${symbol}${amount.toFixed(2)}`;
  }
  return `${symbol}${amount.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export function formatIDR(amount: number): string {
  return formatCurrency(amount, "IDR");
}

export function formatUSDC(amount: number): string {
  return formatCurrency(amount, "USDC");
}
