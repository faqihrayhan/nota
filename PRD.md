# PRD: Nota — POS & Verifiable Accounting System di Arc (Code-Grounded v4.0)

**Status:** v4.0 (Full Code-Level & Architecture Mapping) — Diperbarui 11 Agustus 2026
**Network:** Arc Testnet (Chain ID 5042002) — EVM-compatible, gas dibayar USDC
**Production Domain:** `notapay.vercel.app` (Secured on Vercel free tier, $0)
**Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase (Postgres + Wallet-based RLS), Viem/Wagmi, MetaMask SDK raw, custom EIP-1193 provider (OKX / Rabby `isRabby` / Rainbow `isRainbow`), `next-intl` (planned), OpenZeppelin UUPS Smart Contract (planned)

---

## 1. Ringkasan Produk & Visi Strategis

**Nota** (`notapay.vercel.app`) adalah aplikasi **POS & Verifiable Accounting System** on-chain di atas Arc. Sesuai tagline resminya: **"Tiap transaksi jadi nota. Tiap nota jadi wawasan."**

### Empat Pilar Utama (The Financial OS):
1. **POS & Payments:** Manajemen kasir dan pembayaran USDC instan dengan sub-second finality.
2. **Receipt & Analytics:** Laporan keuangan terstruktur, receipt digital, dan export format resmi (PDF & CSV).
3. **AI Forecast:** Proyeksi pengeluaran dan arus kas masa depan berbasis pola transaksi.
4. **Nota Score:** Reputasi finansial on-chain (Coming Soon feature).

---

## 2. Inventaris Komponen & Struktur Kode Aktif (`src/`)

*Bagian ini mendokumentasikan file-file kode yang sudah dibangun agar tidak perlu konfigurasi ulang jika ada perubahan struktur:*

### 2.1 Layout & Navigasi (`src/components/`, `src/app/`)
- **`src/app/layout.tsx`**: Root layout, Providers wrapper, Metadata ("Nota").
- **`src/app/page.tsx`**: Landing page utama (menggabungkan Hero, FeatureSection, WorkflowSection, StatsSection, FAQ, Footer).
- **`src/components/Nav.tsx`**: Navbar utama dengan dropdown menu **"Fitur"** (Payment, Kasir, Analisa, Forecast) & Docs, bahasa (ID/EN), theme toggle, dan wallet button.
- **`src/components/Footer.tsx`**: Footer dengan link produk, sumber daya (Arc Docs, Arc Scan, Faucet), komunitas, dan tagline resmi.
- **`src/components/Hero.tsx`**: Header visual utama dengan headline *"Tiap transaksi jadi nota. Tiap nota jadi wawasan"* dan CTA.
- **`src/components/FeatureSection.tsx`**: Seksional empat pilar (POS & Payments, Receipt & Analytics, AI Forecast, Nota Score - Coming Soon).
- **`src/components/WorkflowSection.tsx`**: Panduan 3 langkah mudah transaksi on-chain.
- **`src/components/FAQ.tsx`**: Daftar pertanyaan umum interaktif (accordion).

### 2.2 Halaman & Fungsionalitas Utama (`src/app/`, `src/components/`)
- **`src/app/merchant/page.tsx` & `src/components/MerchantPage.tsx`**: Kasir POS & Katalog produk per-wallet di Supabase (`merchant_catalog`), harga USDC-first dengan live FX rate CoinGecko, Cart & QR payment generator.
- **`src/app/payment/page.tsx` & `src/components/PaymentPage.tsx`**: Seksional Scan & Pay camera-first layout (ergonomis HP), konfirmasi transfer USDC (ERC-20 `transferFrom` / native), history transaksi, dan receipt modal (`ReceiptModal.tsx`, `QRScanner.tsx`).
- **`src/app/analisa/page.tsx` & `src/components/AnalisaPage.tsx`**: Ringkasan pengeluaran per kategori, grafik, dan export report (`ExportReport.tsx`).
- **`src/app/forecast/page.tsx` & `src/components/ForecastPage.tsx`**: Proyeksi arus kas masa depan.

### 2.3 State & Wallet Management (`src/context/`, `src/lib/`)
- **`src/context/WalletContext.tsx`**: Multi-wallet provider (MetaMask via SDK raw, OKX Wallet, Rabby `isRabby`, Rainbow `isRainbow`), auto-switch network Arc Testnet (`0x4cbda2`), JWT auto-sign-in untuk Supabase RLS.
- **`src/context/LanguageContext.tsx`**: Toggle bahasa ID / EN (`src/components/LanguageToggle.tsx`).
- **`src/lib/arc-chain.ts`**: Definisi konstanta Chain ID Arc Testnet (5042002 / `0x4cbda2`), RPC, dan native USDC gas config.
- **`src/lib/auth/jwt.ts`**: Verifikasi dan penerbitan token JWT per-wallet untuk RLS Supabase.

---

## 3. Arsitektur Data & Keamanan

### 3.1 Supabase Tables & Wallet RLS
- **`merchant_catalog`**: `id uuid PK, wallet_address text NOT NULL, item_name text NOT NULL, price_usdc numeric NOT NULL, added_at timestamptz`
- **`merchant_cart`**: `id uuid PK, wallet_address text NOT NULL, item_name text NOT NULL, qty int NOT NULL, price_usdc numeric NOT NULL, added_at timestamptz`
- **`transactions`**: keyed `wallet_address` (Protected by Wallet-based RLS policies signed via JWT auth)

### 3.2 On-Chain Settlement (`NotaInvoiceManager.sol` — Planned Phase 2)
- **UUPS Upgradeable Proxy** (OpenZeppelin) di Arc Testnet (`Chain ID 5042002`).
- **Data Anchoring:** Event `InvoicePaid` memuat `bytes32 dataHash` untuk verifikasi keabsahan off-chain data tanpa mengekspos detail privat ke publik.

---

## 4. Keputusan Teknis Terkunci (Architectural Invariants)

| # | Aspek | Keputusan / Standar |
|---|---|---|
| 1 | Model Pembayaran | Pull/allowance (`approve` + `transferFrom`) & Native USDC transfer |
| 2 | Data Storage | Hybrid: Settlement & `dataHash` on-chain; Detail nota & item di Supabase RLS |
| 3 | Wallet Support | MetaMask (SDK raw), OKX, Rabby (`isRabby`), Rainbow (`isRainbow`) |
| 4 | Domain Utama | `notapay.vercel.app` (Vercel Free Tier, $0) |
| 5 | Internationalization | Migrasi ke `next-intl` dengan format JSON per locale (`en.json`, `id.json`) + routing `/{locale}` |
| 6 | Git & CI Workflow | Branch terpisah, wajib `npx tsc --noEmit` & `npm run build` sebelum push |

---

## 5. Roadmap Pengembangan Lengkap (Master Plan)

### Phase 1 — UI/UX & Accounting Foundation (CURRENT)
- [x] Wallet JWT Auth & Supabase RLS per-wallet (PR #11 merged)
- [x] Mobile ergonomics scan & pay layout (Commit 3f37548)
- [x] Multi-wallet support: MetaMask, OKX, Rabby, Rainbow (Commit 36a5204)
- [x] Navbar dropdown, Footer, FeatureSection, FAQ grounded to `notapay.vercel.app`
- [x] Hero SVG vector replacement (`public/images/receipt-hero.svg`)
- [x] Merchant catalog edit & delete items UI
- [x] Migrasi i18n modul JSON (`en.json`, `id.json`)
- [x] Split Display Currency Selector (USDC, IDR, MYR, SGD) dengan live rates CoinGecko
- [x] Receipt PDF & PNG Generator + Tombol & QR Verifikasi ArcScan (*Digital Receipt Modal*)

### Phase 2 — Core Product: Smart Contract di Testnet
- [x] Setup Foundry / Hardhat environment di `~/projects/nota/contracts/`
- [x] Tulis smart contract `NotaInvoiceManager.sol` (UUPS Proxy + `dataHash` anchor + Dual USDC Interface)
- [x] Unit testing (Coverage > 95%) — **100% line/statement/branch/func (21/21 tests pass)**
- [x] Deploy ke Arc Testnet (`Chain ID 5042002`) — **Proxy `0x7a6645d96c6644c9c4c0601c9b0df05358559c1c` (verified di ArcScan)**
- [x] Integrasi UI Payment frontend ke contract yang di-deploy (`src/lib/invoice-manager.ts`)
- [ ] QR Payload HMAC Signature (Anti-forge)

### Phase 3 — Accounting Analytics & Merchant Inflow (CURRENT)
- [ ] Merchant Inflow Dashboard & Revenue Stats (Harian / Bulanan)
- [x] Payer Outflow Analytics enhancements (cashflow inflow/outflow/net + trend + insight di AnalisaPage)
- [x] Export Accounting Report CSV (client-side Blob, anti CSV-injection)
- [ ] Export Accounting Report PDF

### Phase 4 — Mainnet Launch & Public Repo
- [ ] Buka repo GitHub menjadi Public
- [ ] Deploy contract ke Arc Mainnet (`Chain ID 5042`)
- [ ] Scale Locale SEA (`vi`, `tl`, `th`)

---

## 6. Constraints & Developer Rules
- Arc Testnet — token bernilai uji coba (testnet USDC).
- Supabase anon key publik di frontend → RLS wajib diaktifkan untuk semua tabel.
- Verifikasi rilis: `npx tsc --noEmit` → `npm run build` → push → tunggu 2-3 menit → cek CI.

---
*Single Source of Truth (SSOT) — Nota Code-Grounded v4.0.*
