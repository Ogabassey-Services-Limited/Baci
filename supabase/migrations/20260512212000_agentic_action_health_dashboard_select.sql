DROP POLICY IF EXISTS "Merchant and staff can view agentic request records"
  ON public.agentic_request_records;
CREATE POLICY "Merchant and staff can view agentic request records"
  ON public.agentic_request_records
  FOR SELECT
  TO authenticated
  USING (public.has_merchant_access(merchant_id));

DROP POLICY IF EXISTS "Merchant and staff can view agentic idempotency records"
  ON public.agentic_idempotency_records;
CREATE POLICY "Merchant and staff can view agentic idempotency records"
  ON public.agentic_idempotency_records
  FOR SELECT
  TO authenticated
  USING (public.has_merchant_access(merchant_id));
