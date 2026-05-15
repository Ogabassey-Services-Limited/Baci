REVOKE INSERT, UPDATE ON public.imei_lookups FROM authenticated;

GRANT INSERT (
  amount_ngn,
  customer_id,
  idempotency_key,
  imei_hash,
  merchant_id,
  status,
  tier
) ON public.imei_lookups TO authenticated;

GRANT UPDATE (
  cached_response,
  cached_status,
  response_hash,
  sickw_status,
  status
) ON public.imei_lookups TO authenticated;
