ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transaction_date timestamptz;

UPDATE public.orders
SET transaction_date = created_at
WHERE transaction_date IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN transaction_date SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_orders_merchant_transaction_date
  ON public.orders (merchant_id, transaction_date DESC);
