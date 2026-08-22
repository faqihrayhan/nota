# Nota On-Chain Payment & Financial OS

> **Pay with a QR code. Get an on-chain receipt, spending analysis, and a forecast for next month.**

Nota is a stablecoin-native payment app and financial operating system built on the
[Arc Network](https://arc.io) testnet. Every payment becomes a *nota* (Indonesian for
"receipt") a digital record that lives on-chain, feeds your spending insights, and
projects what your next month looks like.

Think of it like a triplicate receipt book, except one copy lives on the blockchain:
provably permanent, cryptographically verifiable, and unforgeable.

---

## ✨ Features

| Feature | What it does | Status |
|---|---|---|
| **Scan & Pay** | Show a payment QR or scan one; pay in USDC with your wallet; transaction is logged on-chain automatically | ✅ Live |
| **Merchant POS** | Product catalog, cart, live USDC/IDR pricing via CoinGecko, and QR invoice generation | ✅ Live |
| **Receipts** | Digital receipt per transaction viewable on-screen or exported as PDF | ✅ Live |
| **Insights** | Auto-categorized breakdown of where your money went | ✅ Live |
| **Forecast** | Projected spending for next month, based on your transaction history | ✅ Live |
| **Nota Score** | Wallet health score derived from on-chain payment behavior | ✅ Live |
| **Split Bill** | Split a bill among friends on-chain | ✅ Live |
| **i18n** | Full Indonesian / English language toggle | ✅ Live |
| **Dark / Light** | Theme switcher (system-aware via `next-themes`) | ✅ Live |

Landing page, wallet connection, dark/light mode, and ID/EN language support are all
live.

---

## 🛠 Tech Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** server components where
  possible, client components where interactivity lives
- **Tailwind CSS v4** utility-first styling
- **Framer Motion** scroll-reveal animations with reduced-motion fallbacks
- **EIP-1193 wallet integration** custom provider abstraction (MetaMask via
  `@metamask/sdk`, OKX, Rabby, Rainbow)
- **USDC payments** direct ERC-20 `transferFrom` calldata against Arc's native USDC
- **NotaInvoiceManager (Solidity)** UUPS-upgradeable smart contract — on-chain
  invoice creation, payment, split bill, and `dataHash` anchoring. Built with
  Foundry + OpenZeppelin Contracts Upgradeable
- **Supabase (Postgres)** catalog, cart, and transaction storage with per-wallet Row
  Level Security; wallet auth via challenge/sign JWT flow; `localStorage` fallback
  for wallet/language persistence
- **QR** `qrcode.react` (generate) + `html5-qrcode` (scan camera)
- **Receipt export** `jspdf` + `html-to-image` (PDF download)
- **i18n** custom ID/EN dictionary (`src/i18n/`)

### Wallet support

| Wallet | Status |
|---|---|
| MetaMask | ✅ (SDK) |
| OKX | ✅ |
| Rabby | ✅ |
| Rainbow | ✅ |

---

## ⛓ Arc Testnet

| Parameter | Value |
|---|---|
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` (hex `0x4cef52`) |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |
| Faucet | [faucet.circle.com](https://faucet.circle.com) |
| Gas token | USDC native 18 decimals, ERC-20 6 decimals |
| Network type | **Testnet** tokens have **no real value** |

> ⚠️ **Heads up:** Nota runs on Arc **Testnet**. All transactions here use test tokens
> with no real-world value purely for building and testing.

---

## 🚀 Getting Started

```bash
# 1. Clone
git clone https://github.com/faqihrayhan/nota.git
cd nota

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local   # if present, or create one
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 4. Run the dev server
npm run dev
# Open http://localhost:3000
```

### Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run prepare` | Install Husky git hooks |

### Quality gates

Husky `pre-commit` runs **`tsc --noEmit` + ESLint** before every commit no type
errors, no lint errors, no commit.

---

## 📁 Project Structure

```
src/
├── app/          # Routing & layouts (Next.js App Router)
│   ├── page.tsx          # Landing page
│   ├── api/auth/         # Wallet auth endpoints (challenge + verify)
│   ├── payment/          # Scan & Pay
│   ├── merchant/         # Merchant POS
│   ├── analisa/          # Spending insights
│   ├── forecast/         # Next-month forecast
│   ├── score/            # Nota Score
│   └── split-bill/       # Split bill
├── components/   # UI components (MerchantPage, PaymentPage, QRScanner, ReceiptModal…)
│   └── analytics/        # Analytics widgets (CategoryDonut, MetricCard, RevenueChart)
├── context/      # React Context (WalletContext, LanguageContext)
├── lib/          # Config & helpers (arc-chain, usdc-abi, invoice-manager, qr-hmac, supabase, exchange-rate)
└── i18n/         # ID/EN translation dictionaries
```

### Key modules

| Module | Role |
|---|---|
| `src/lib/arc-chain.ts` | Arc Testnet chain config (EIP-3085 params, explorer URL) |
| `src/lib/usdc-abi.ts` | USDC ERC-20 ABI + contract address |
| `src/lib/invoice-manager.ts` | `NotaInvoiceManager` proxy address, function selectors, ABI encoding helpers |
| `src/lib/qr-hmac.ts` | QR payload HMAC signing & verification (keccak-256) |
| `src/lib/supabase.ts` | Typed Supabase data layer (catalog, cart, transactions) |
| `src/lib/exchange-rate.ts` | Live CoinGecko USDC/IDR rate with fallback |
| `src/context/WalletContext.tsx` | EIP-1193 provider abstraction & wallet state |
| `src/components/QRScanner.tsx` | Camera-based QR scanning |

---

## 🔒 Security & Data Model

- **Per-wallet Row Level Security (RLS)** is enforced on `transactions`,
  `merchant_catalog`, and `merchant_cart` tables in Supabase. Each wallet can only
  read/write its own data; catalog items are publicly readable but owner-writable.
- **Wallet authentication** uses a challenge/sign flow: the server issues a random
  nonce, the wallet signs it, and the server returns a JWT with a `wallet_address`
  claim used by all RLS policies.
- **QR payload signing** — every payment QR includes a keccak-256 HMAC; the scanner
  verifies it before processing (anti-tamper, anti-phishing).
- Prices are stored natively in **USDC** (`price_usdc`), with IDR conversion handled at
  display time using the live CoinGecko rate (fallback `16200` IDR/USDC if the API is
  unreachable).
- Transaction IDs are server-generated UUIDs (`gen_random_uuid()` default).

---

## 🗺 Roadmap

### v1 (current) Stablecoin POS & Insights
- [x] Scan & Pay with QR (USDC on Arc Testnet)
- [x] Merchant catalog, cart, live IDR/USDC pricing
- [x] Receipts, insights, forecast, Nota Score, split bill
- [x] Wallet support: MetaMask SDK, OKX, Rabby, Rainbow
- [x] ID/EN i18n + dark/light mode
- [x] Supabase persistence with RLS enabled

### v2 Payment Hardening & On-Chain Invoices
- [x] **Phase 5 Payment Hardening**: per-wallet RLS policies (private catalog/cart,
      own-transactions-only), wallet auth (challenge/sign JWT), QR payload HMAC
      signing & validation (anti-tamper, anti-phishing)
- [x] **Phase 6 Smart Contract Core**: `NotaInvoiceManager.sol` (UUPS proxy) deployed
      on Arc Testnet — on-chain invoice create & pay (`createAndPayInvoice`), split
      bill (`createSplit` / `paySplit` / `completeSplit`), `dataHash` anchoring,
      rich events. Supabase as indexer of contract events
- [ ] **Phase 7 Nota Score v2**: incorporate on-chain verified payment history
      (cryptographically valid, not just DB entries)

---

## 🧱 Built on Arc

This project is built on [Arc](https://arc.io) infrastructure a stablecoin-native
network purpose-built for payments: predictable low gas, USDC settlement, and
trustless verification. See the
[Arc Brand Guidelines](https://www.arc.io/brand-guidelines-and-partner-toolkit) for
partner assets.

---

## 📄 License

Private project all rights reserved.
