-- Migration: Add batch/stock and enhance merchant_catalog & merchant_cart
-- Date: 2026-08-11

BEGIN;

-- 1. Enhance merchant_catalog for inventory, batches, SKU, and attributes
ALTER TABLE IF EXISTS public.merchant_catalog
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS stock NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_no TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure merchant_cart has item reference or batch info if needed
ALTER TABLE IF EXISTS public.merchant_cart
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.merchant_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_no TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

COMMIT;
