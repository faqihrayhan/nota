"use client";

import { Nav } from "@/components/Nav";
// MerchantPage disimpan utuh di src/components/MerchantPage.tsx agar mudah diaktifkan kembali
// import MerchantPage from "@/components/MerchantPage";
import { MerchantClosedPage } from "@/components/MerchantClosedPage";
import { Footer } from "@/components/Footer";

export default function MerchantRoute() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        {/* Akses Merchant POS ditutup sementara, menampilkan MerchantClosedPage */}
        <MerchantClosedPage />
      </main>
      <Footer />
    </>
  );
}
