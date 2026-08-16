-- Migration: Server-side stock deduction support
-- Nota project — Arc POS.
--
-- Why: `deductStockAfterPayment` previously ran on the PAYER's device, but
-- `merchant_catalog` RLS only allows the OWNER (merchant) to update rows, so
-- the deduction always failed (403) unless payer === merchant.
--
-- Fix: deduction moved to a server route (/api/merchant/stock/deduct) using
-- the service-role key that bypasses RLS. To keep it idempotent, we add a
-- one-time claim flag `stock_deducted` on `transactions` — the route flips it
-- atomically so a nonce can never deduct stock twice.
--
-- Rollback:
--   ALTER TABLE public.transactions DROP COLUMN IF EXISTS stock_deducted;

BEGIN;

ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

COMMIT;