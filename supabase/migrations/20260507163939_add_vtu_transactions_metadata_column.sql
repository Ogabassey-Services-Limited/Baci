ALTER TABLE public.vtu_transactions
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

UPDATE public.vtu_transactions
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.vtu_transactions
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
