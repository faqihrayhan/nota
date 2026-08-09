import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SplitBillPage } from "@/components/SplitBillPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Split Bill — Nota",
  description: "Bagi tagihan on-chain dengan mudah di Arc Testnet.",
};

export default function SplitBill() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <SplitBillPage />
      </main>
      <Footer />
    </>
  );
}
