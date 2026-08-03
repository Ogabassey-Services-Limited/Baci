-- Re-apply the Santa analytics RPC after the initial rate-limit hardening.
-- Resolve the published merchant before consuming the limiter so callers
-- cannot create rate-limit rows for arbitrary slugs. Use the merchant UUID in
-- the anonymous bucket and keep the analytics window at one minute.

CREATE OR REPLACE FUNCTION public.record_santa_interaction(
  p_merchant_slug text,
  p_session_id text,
  p_client_ip text,
  p_interaction_type text,
  p_user_message text DEFAULT NULL,
  p_santa_response text DEFAULT NULL,
  p_product_name text DEFAULT NULL,
  p_requested_price numeric DEFAULT NULL,
  p_approved_price numeric DEFAULT NULL,
  p_discount_percentage numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant_id uuid;
  v_rate_allowed boolean;
BEGIN
  IF p_merchant_slug IS NULL
    OR pg_catalog.length(pg_catalog.btrim(p_merchant_slug)) NOT BETWEEN 1 AND 100
    OR p_session_id IS NULL
    OR pg_catalog.length(p_session_id) NOT BETWEEN 1 AND 64
    OR p_client_ip IS NULL
    OR pg_catalog.length(p_client_ip) > 64
    OR p_interaction_type IS NULL
    OR p_interaction_type NOT IN (
      'chat',
      'wish_granted',
      'wish_denied',
      'add_to_cart',
      'checkout_started',
      'checkout_completed'
    )
    OR (p_product_name IS NOT NULL AND pg_catalog.length(p_product_name) > 200)
    OR (p_user_message IS NOT NULL AND pg_catalog.length(p_user_message) > 500)
    OR (p_santa_response IS NOT NULL AND pg_catalog.length(p_santa_response) > 1000)
    OR (p_requested_price IS NOT NULL AND (p_requested_price < 0 OR p_requested_price > 1000000000000))
    OR (p_approved_price IS NOT NULL AND (p_approved_price < 0 OR p_approved_price > 1000000000000))
    OR (p_discount_percentage IS NOT NULL AND (p_discount_percentage < 0 OR p_discount_percentage > 100))
  THEN
    RETURN;
  END IF;

  SELECT m.id
  INTO v_merchant_id
  FROM public.merchants AS m
  WHERE m.slug = pg_catalog.btrim(p_merchant_slug)
    AND COALESCE(m.is_published, false) = true
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    RETURN;
  END IF;

  -- p_client_ip is telemetry supplied by the caller, so it cannot be an
  -- authorization or rate-limit identity. Anonymous calls share one bounded
  -- bucket per published merchant; authenticated calls use the database auth
  -- identity inside check_rate_limit.
  BEGIN
    v_rate_allowed := public.check_rate_limit(
      'santa-analytics:' || COALESCE(auth.uid()::text, 'anon') || ':' || v_merchant_id::text,
      'santa_interaction_rpc',
      60,
      1
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_rate_allowed := false;
  END;

  IF v_rate_allowed IS DISTINCT FROM true THEN
    RETURN;
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
  )
  VALUES (
    v_merchant_id,
    p_session_id,
    p_client_ip,
    p_interaction_type,
    p_user_message,
    p_santa_response,
    p_product_name,
    p_requested_price,
    p_approved_price,
    p_discount_percentage
  );
END;
$$;
