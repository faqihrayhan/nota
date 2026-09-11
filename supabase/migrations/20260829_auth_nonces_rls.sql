-- 20260829_auth_nonces_rls.sql
-- Enable RLS on auth_nonces (deny-all, no policies).
--
-- Why: Supabase Security Advisor flagged CRITICAL "RLS Disabled in Public".
-- The table previously had RLS off because the auth routes used the anon key.
-- Those routes now use SUPABASE_SERVICE_ROLE_KEY (server-only), which bypasses
-- RLS — so RLS can be enabled with zero policies:
--   - anon / authenticated / wallet JWTs -> zero rows (deny-all)
--   - service role (server routes)        -> full access, unaffected
--
-- Expired-nonce cleanup is done opportunistically by /api/auth/challenge.
--
-- Deploy order (fail-closed): code that uses the service-role key must be
-- deployed BEFORE this migration, or wallet login breaks until it is.

ALTER TABLE public.auth_nonces ENABLE ROW LEVEL SECURITY;
