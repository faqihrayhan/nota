-- Migration: make transactions.id server-generated (uuid default)
-- Fix permanent untuk error: null value in column "id" of relation "transactions"
-- (sebelumnya id text NOT NULL tanpa default; klien harus isi manual)
--
-- Data lama berisi id string acak (non-uuid, contoh: 'q7ofsc8xr8h').
-- Karena id lama tidak dirujuk relasi mana pun, kita ganti dengan uuid baru.

BEGIN;

-- 1) Drop the old primary key on text id
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;

-- 2) Recreate the column as uuid with a server-side default.
--    Id lama (non-uuid) di-generate ulang; baris tanpa id tidak mungkin ada
--    karena NOT NULL, tapi kita beri default juga demi keamanan.
ALTER TABLE public.transactions
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE uuid USING gen_random_uuid(),
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3) Re-add the primary key
ALTER TABLE public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

COMMIT;
