-- Migration: rename price_idr -> price_usdc (store prices in USDC)
-- Nota project — Arc POS. Converts existing IDR values to USDC using 16200 rate.

BEGIN;

-- 1) Convert existing IDR values to USDC before renaming (data migration)
UPDATE public.merchant_catalog
SET price_idr = ROUND(price_idr::numeric / 16200.0, 6);

UPDATE public.merchant_cart
SET price_idr = ROUND(price_idr::numeric / 16200.0, 6);

-- 2) Rename columns
ALTER TABLE public.merchant_catalog RENAME COLUMN price_idr TO price_usdc;
ALTER TABLE public.merchant_cart RENAME COLUMN price_idr TO price_usdc;

COMMIT;

-- Sanity checks (run after migration)
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'merchant_catalog' AND column_name LIKE 'price%';
-- SELECT name, price_usdc FROM public.merchant_catalog LIMIT 5;
