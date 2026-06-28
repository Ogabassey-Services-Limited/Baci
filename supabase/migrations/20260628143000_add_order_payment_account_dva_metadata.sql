ALTER TABLE public.order_payment_accounts
  ADD COLUMN IF NOT EXISTS payable_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;

UPDATE public.order_payment_accounts
SET assigned_at = created_at
WHERE assigned_at IS NULL;

COMMENT ON COLUMN public.order_payment_accounts.payable_amount IS
  'Expected DVA payable amount after wallet or savings credits, in order currency units.';

COMMENT ON COLUMN public.order_payment_accounts.assigned_at IS
  'Timestamp when the current virtual account assignment was returned to the customer.';
