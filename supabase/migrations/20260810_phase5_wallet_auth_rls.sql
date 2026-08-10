-- Migration: Phase 5 — Wallet auth & per-wallet RLS
-- Nota project — Arc POS.
--
-- What this does:
-- 1. Creates `auth_nonces` table (one-time SIWE-style sign-in nonces).
-- 2. Drops the permissive "Allow all" policies on transactions / merchant_catalog / merchant_cart.
-- 3. Adds per-wallet RLS policies that read the wallet address from the JWT
--    claim `wallet_address` (issued by /api/auth/wallet, signed with SUPABASE_JWT_SECRET).
--
-- IMPORTANT (deploy order):
--   a) Add SUPABASE_JWT_SECRET to .env.local + Vercel env BEFORE pushing this.
--   b) Deploy the app (route /api/auth/wallet) FIRST so users can obtain JWTs,
--      THEN push this migration. Otherwise all wallet-scoped queries fail closed.
--   c) The RLS function `auth.jwt()` is available on Supabase by default.
--
-- NOTE on auth_nonces: RLS is intentionally NOT enabled on this table. The
-- challenge/verify API routes use the anon key WITHOUT a JWT (they must, since
-- the whole point is to ISSUE the JWT). Nonces are random 128-bit values,
-- single-use, 5-minute TTL — a leaked nonce is useless without a valid wallet
-- signature. Enabling RLS here would break the sign-in flow entirely.
--
-- Rollback: re-run the old "Allow all" policies (kept at the bottom, commented).

BEGIN;

-- ── 1) auth_nonces (no RLS — see note above) ──────────────────
CREATE TABLE IF NOT EXISTS public.auth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_nonces_wallet_idx ON public.auth_nonces (wallet_address);
CREATE INDEX IF NOT EXISTS auth_nonces_expires_idx ON public.auth_nonces (expires_at);

-- ── 2) transactions — per-wallet ───────────────────────────────
-- Drop the permissive policies (both the "Allow all" and the old anon ones).
DROP POLICY IF EXISTS "Allow all on transactions" ON public.transactions;
DROP POLICY IF EXISTS "allow insert for anon" ON public.transactions;
DROP POLICY IF EXISTS "allow select for anon" ON public.transactions;

-- A user sees only their own transactions.
CREATE POLICY "wallet can select own transactions" ON public.transactions
  FOR SELECT TO anon
  USING ((auth.jwt() ->> 'wallet_address') = wallet_address);

-- A user can insert transactions that belong to them.
-- The wallet_address in the row must match the JWT claim.
CREATE POLICY "wallet can insert own transactions" ON public.transactions
  FOR INSERT TO anon
  WITH CHECK ((auth.jwt() ->> 'wallet_address') = wallet_address);

-- ── 3) merchant_catalog — public read, owner write ─────────────
DROP POLICY IF EXISTS "Allow all on merchant_catalog" ON public.merchant_catalog;

-- Anyone (anon) can read any catalog — buyers need to see merchant items.
CREATE POLICY "catalog public read" ON public.merchant_catalog
  FOR SELECT TO anon
  USING (true);

-- Only the owning wallet can add/edit/delete their catalog items.
CREATE POLICY "catalog owner insert" ON public.merchant_catalog
  FOR INSERT TO anon
  WITH CHECK ((auth.jwt() ->> 'wallet_address') = wallet_address);

CREATE POLICY "catalog owner update" ON public.merchant_catalog
  FOR UPDATE TO anon
  USING ((auth.jwt() ->> 'wallet_address') = wallet_address)
  WITH CHECK ((auth.jwt() ->> 'wallet_address') = wallet_address);

CREATE POLICY "catalog owner delete" ON public.merchant_catalog
  FOR DELETE TO anon
  USING ((auth.jwt() ->> 'wallet_address') = wallet_address);

-- ── 4) merchant_cart — owner only ──────────────────────────────
DROP POLICY IF EXISTS "Allow all on merchant_cart" ON public.merchant_cart;

CREATE POLICY "cart owner select" ON public.merchant_cart
  FOR SELECT TO anon
  USING ((auth.jwt() ->> 'wallet_address') = wallet_address);

CREATE POLICY "cart owner insert" ON public.merchant_cart
  FOR INSERT TO anon
  WITH CHECK ((auth.jwt() ->> 'wallet_address') = wallet_address);

CREATE POLICY "cart owner update" ON public.merchant_cart
  FOR UPDATE TO anon
  USING ((auth.jwt() ->> 'wallet_address') = wallet_address)
  WITH CHECK ((auth.jwt() ->> 'wallet_address') = wallet_address);

CREATE POLICY "cart owner delete" ON public.merchant_cart
  FOR DELETE TO anon
  USING ((auth.jwt() ->> 'wallet_address') = wallet_address);

COMMIT;

-- ── Rollback (run manually if needed) ──────────────────────────
-- BEGIN;
-- CREATE POLICY "Allow all on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all on merchant_catalog" ON public.merchant_catalog FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all on merchant_cart" ON public.merchant_cart FOR ALL USING (true) WITH CHECK (true);
-- DROP TABLE IF EXISTS public.auth_nonces;
-- COMMIT;
