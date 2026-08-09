"use client";

import { Nav } from "@/components/Nav";
import MerchantPage from "@/components/MerchantPage";
import { Footer } from "@/components/Footer";

export default function MerchantRoute() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <MerchantPage />
      </main>
      <Footer />
    </>
  );
}
