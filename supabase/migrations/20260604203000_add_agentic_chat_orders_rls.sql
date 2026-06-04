CREATE OR REPLACE FUNCTION public.current_agentic_session_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(BTRIM(auth.jwt() ->> 'agentic_session_id'), '')
$$;

COMMENT ON FUNCTION public.current_agentic_session_id() IS
  'Returns the chat session id from a server-signed agentic checkout JWT for session-scoped RLS policies.';

DROP POLICY IF EXISTS "Agentic chat orders are insertable by scoped client" ON public.chat_orders;
CREATE POLICY "Agentic chat orders are insertable by scoped client"
  ON public.chat_orders
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
    AND session_id = public.current_agentic_session_id()
    AND status = 'pending_payment'
  );

DROP POLICY IF EXISTS "Agentic chat orders are readable by scoped client" ON public.chat_orders;
CREATE POLICY "Agentic chat orders are readable by scoped client"
  ON public.chat_orders
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
    AND session_id = public.current_agentic_session_id()
  );
