DROP POLICY IF EXISTS "Agentic checkout orders are readable by scoped client" ON public.orders;

CREATE POLICY "Agentic checkout orders are readable by scoped client"
  ON public.orders
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
    AND source = 'agentic_ai'
  );
