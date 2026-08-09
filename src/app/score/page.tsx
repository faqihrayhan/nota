import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScorePage } from "@/components/ScorePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nota Score — Reputasi Finansial On-Chain",
  description: "Cek skor reputasi pembayaran wallet Anda berdasarkan histori transaksi on-chain di Arc.",
};

export default function Score() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <ScorePage />
      </main>
      <Footer />
    </>
  );
}
