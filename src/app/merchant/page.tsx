import type { Metadata } from "next";
import { MerchantPage } from "@/components/MerchantPage";

export const metadata: Metadata = {
  title: "Merchant POS — Nota",
  description:
    "Kasir digital Nota: kelola katalog produk, susun pesanan, dan terima pembayaran USDC instan dengan konversi IDR real-time di Arc.",
};

export default function Merchant() {
  return <MerchantPage />;
}
