-- Migration: Merchant incoming transactions read access
-- Nota project — Arc POS.
--
-- Why: the existing "wallet can select own transactions" policy scopes
-- SELECT by `wallet_address` (which is the PAYER's address). Merchants
-- therefore cannot read payments that arrive at their address — required by:
--   1) MerchantPage real-time "payment received" auto-detection
--   2) AnalisaPage cashflow analysis (inflow side)
--
-- This ADDS one SELECT policy (no drops, no changes to existing policies):
-- a wallet may also read any row where it is the payee. Combined with the
-- existing policy, a row is visible if `wallet_address` = JWT claim OR
-- `payee_address` = JWT claim.
--
-- Rollback:
--   DROP POLICY "wallet can select incoming transactions" ON public.transactions;

BEGIN;

CREATE POLICY "wallet can select incoming transactions" ON public.transactions
  FOR SELECT TO anon
  USING ((auth.jwt() ->> 'wallet_address') = payee_address);

COMMIT;