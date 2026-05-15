GRANT INSERT, UPDATE ON public.imei_lookups TO authenticated;

DROP POLICY IF EXISTS "customer_inserts_own_imei_lookups"
  ON public.imei_lookups;
CREATE POLICY "customer_inserts_own_imei_lookups" ON public.imei_lookups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = imei_lookups.customer_id
        AND c.merchant_id = imei_lookups.merchant_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "customer_updates_own_imei_lookups"
  ON public.imei_lookups;
CREATE POLICY "customer_updates_own_imei_lookups" ON public.imei_lookups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = imei_lookups.customer_id
        AND c.merchant_id = imei_lookups.merchant_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = imei_lookups.customer_id
        AND c.merchant_id = imei_lookups.merchant_id
        AND c.user_id = (SELECT auth.uid())
    )
  );
