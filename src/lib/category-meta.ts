// ─── Feature-based category meta ─────────────────────────────────────────
// Nota groups analytics by FEATURE rather than shopping-style categories:
//   merchant_pos  — POS merchant QR payments (MerchantPage)
//   split_bill    — Split Bill QR payments (SplitBillPage)
//   payment       — direct / generic Scan&Pay payments (incl. legacy rows)
//   receive       — incoming transfers (payee) not matched above
//
// Legacy category values (shopping-style) are mapped into the new feature
// buckets so historical rows keep showing up with a translated label.

export type FeatureCategory = "payment" | "merchant_pos" | "split_bill" | "receive";

const LEGACY_TO_FEATURE: Record<string, FeatureCategory> = {
  belanja: "merchant_pos",
  shopping: "merchant_pos",
  split: "split_bill",
  split_bill: "split_bill",
  makan: "payment",
  transport: "payment",
  hiburan: "payment",
  kesehatan: "payment",
  lainnya: "payment",
  lain: "payment",
  other: "payment",
};

export function toFeatureCategory(category: string | null | undefined): FeatureCategory {
  const raw = (category || "payment").toLowerCase().trim();
  if (LEGACY_TO_FEATURE[raw]) return LEGACY_TO_FEATURE[raw];
  if (
    raw === "payment" ||
    raw === "merchant" ||
    raw === "merchant_pos" ||
    raw === "pos" ||
    raw === "receive" ||
    raw === "incoming"
  ) {
    return raw === "merchant" || raw === "pos" ? "merchant_pos" : raw === "incoming" || raw === "receive" ? "receive" : "payment";
  }
  return "payment";
}

export const FEATURE_CATEGORY_KEYS: FeatureCategory[] = [
  "payment",
  "merchant_pos",
  "split_bill",
  "receive",
];

export function categoryLabelKey(category: string | null | undefined): string {
  return `category.feature.${toFeatureCategory(category)}`;
}

/**
 * Returns the effective feature category based on whether the user is payer or payee.
 * - Payer (outflow): Merchant POS payments are shown as "payment" (Pembayaran).
 * - Payee (inflow): Payments with items or merchant_pos category are shown as "merchant_pos" (Merchant POS).
 *                   Generic incoming transfers without items are shown as "receive" (Terima).
 */
export function getEffectiveCategory(
  tx: { category?: string | null; items?: unknown[] | null; payer_address: string; payee_address: string },
  userAddr: string
): FeatureCategory {
  const feat = toFeatureCategory(tx.category);
  const isPayer = tx.payer_address.toLowerCase() === userAddr.toLowerCase();

  if (isPayer) {
    if (feat === "merchant_pos") return "payment";
    if (feat === "split_bill") return "split_bill";
    return "payment";
  } else {
    if (feat === "split_bill") return "split_bill";
    // If it has merchant items or is category merchant_pos/belanja/shopping -> merchant_pos
    if (feat === "merchant_pos" || (Array.isArray(tx.items) && tx.items.length > 0)) {
      return "merchant_pos";
    }
    return "receive";
  }
}