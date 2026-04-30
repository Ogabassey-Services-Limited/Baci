CREATE OR REPLACE FUNCTION public.current_agentic_merchant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN (auth.jwt() ->> 'agentic_merchant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt() ->> 'agentic_merchant_id')::uuid
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.is_agentic_checkout_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() ->> 'agentic_context') = 'checkout', FALSE)
$$;

DROP POLICY IF EXISTS "Agentic checkout sessions are writable by scoped client" ON public.checkout_sessions;
CREATE POLICY "Agentic checkout sessions are writable by scoped client"
  ON public.checkout_sessions
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic checkout sessions are deletable by scoped client" ON public.checkout_sessions;
CREATE POLICY "Agentic checkout sessions are deletable by scoped client"
  ON public.checkout_sessions
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic checkout sessions are merchant scoped (restrictive)" ON public.checkout_sessions;
CREATE POLICY "Agentic checkout sessions are merchant scoped (restrictive)"
  ON public.checkout_sessions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.is_agentic_checkout_context()
    OR merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    NOT public.is_agentic_checkout_context()
    OR merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic checkout orders are writable by scoped client" ON public.orders;
CREATE POLICY "Agentic checkout orders are writable by scoped client"
  ON public.orders
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic checkout orders are merchant scoped (restrictive)" ON public.orders;
CREATE POLICY "Agentic checkout orders are merchant scoped (restrictive)"
  ON public.orders
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.is_agentic_checkout_context()
    OR merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    NOT public.is_agentic_checkout_context()
    OR merchant_id = public.current_agentic_merchant_id()
  );
