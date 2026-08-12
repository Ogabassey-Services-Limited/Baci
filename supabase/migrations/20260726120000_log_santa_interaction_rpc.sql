-- Santa chat analytics: replace the anonymous endpoint's service-role client
-- with a bounded SECURITY DEFINER RPC.
--
-- POST /api/chat/santa is an ANONYMOUS storefront endpoint. It previously
-- constructed a generic service-role Supabase client to insert into
-- santa_interactions (whose RLS only grants INSERT to service_role), which
-- bypasses RLS from a user-facing path and is not one of the owner-approved
-- legacy-analytics service-role exceptions. This RPC moves the privileged
-- insert behind a single, validated definer boundary the anon route calls via
-- its normal RLS-scoped client — no service-role client in the request graph.
--
-- The function validates the merchant exists and the interaction type is known,
-- bounds the free-text fields server-side (defence in depth), and inserts. It
-- returns void; analytics failures must never surface to the caller.

CREATE OR REPLACE FUNCTION public.log_santa_interaction(
  p_merchant_id uuid,
  p_session_id text,
  p_client_ip text,
  p_interaction_type text,
  p_user_message text DEFAULT NULL,
  p_santa_response text DEFAULT NULL,
  p_product_name text DEFAULT NULL,
  p_requested_price numeric DEFAULT NULL,
  p_approved_price numeric DEFAULT NULL,
  p_discount_percentage numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id text;
BEGIN
  -- Analytics rows must be attributed to a real merchant.
  IF p_merchant_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.merchants AS m WHERE m.id = p_merchant_id
     ) THEN
    RAISE EXCEPTION 'invalid_merchant';
  END IF;

  IF p_interaction_type IS NULL
     OR p_interaction_type NOT IN (
       'chat', 'wish_granted', 'wish_denied',
       'add_to_cart', 'checkout_started', 'checkout_completed'
     ) THEN
    RAISE EXCEPTION 'invalid_interaction_type';
  END IF;

  v_session_id := NULLIF(pg_catalog.btrim(COALESCE(p_session_id, '')), '');
  IF v_session_id IS NULL OR pg_catalog.length(v_session_id) > 200 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  INSERT INTO public.santa_interactions (
    merchant_id,
    session_id,
    client_ip,
    interaction_type,
    user_message,
    santa_response,
    product_name,
    requested_price,
    approved_price,
    discount_percentage
  ) VALUES (
    p_merchant_id,
    v_session_id,
    pg_catalog.left(COALESCE(p_client_ip, ''), 64),
    p_interaction_type,
    pg_catalog.left(p_user_message, 500),
    pg_catalog.left(p_santa_response, 1000),
    pg_catalog.left(p_product_name, 200),
    p_requested_price,
    p_approved_price,
    p_discount_percentage
  );
END;
$$;

ALTER FUNCTION public.log_santa_interaction(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric
) OWNER TO postgres;

-- Supabase default-grants EXECUTE to PUBLIC/anon on new functions. Revoke the
-- blanket grant, then grant only the roles the anon storefront route runs as.
REVOKE EXECUTE ON FUNCTION public.log_santa_interaction(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_santa_interaction(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.log_santa_interaction(
  uuid, text, text, text, text, text, text, numeric, numeric, numeric
) IS
  'Bounded SECURITY DEFINER insert for Santa chat analytics so the anonymous '
  '/api/chat/santa route records interactions without a service-role client. '
  'Validates merchant + interaction type, bounds free-text fields, returns void.';
