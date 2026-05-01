COMMENT ON FUNCTION public.current_agentic_merchant_id() IS
  'Returns the merchant UUID from a server-signed agentic checkout JWT after validating the claim shape before casting.';

COMMENT ON FUNCTION public.is_agentic_checkout_context() IS
  'Returns true only for authenticated requests carrying the server-signed agentic checkout context claim.';

DROP POLICY IF EXISTS "Agentic checkout sessions are readable by scoped client" ON public.checkout_sessions;
CREATE POLICY "Agentic checkout sessions are readable by scoped client"
  ON public.checkout_sessions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );
