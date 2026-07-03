-- disable-transaction

ALTER TABLE public.negotiation_requests
  ADD COLUMN IF NOT EXISTS customer_email text;

COMMENT ON COLUMN public.negotiation_requests.customer_email IS
  'Optional guest email captured with negotiation evidence so accept/reject decisions can be sent without an app account.';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_negotiation_requests_merchant_customer_email
  ON public.negotiation_requests (merchant_id, lower(customer_email))
  WHERE customer_email IS NOT NULL;
