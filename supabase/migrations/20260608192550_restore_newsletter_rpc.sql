-- Restore newsletter subscribe/unsubscribe RPCs used by the public storefront API.
-- The public route uses an anon Supabase client, so the functions encapsulate
-- the idempotent lookup/update needed without exposing subscriber reads.

CREATE OR REPLACE FUNCTION public.subscribe_newsletter(
  p_email text,
  p_merchant_id uuid DEFAULT NULL,
  p_source text DEFAULT 'widget'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_source text := COALESCE(NULLIF(trim(p_source), ''), 'widget');
  v_id uuid;
  v_status text;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF v_source NOT IN ('widget', 'footer', 'checkout', 'popup') THEN
    v_source := 'widget';
  END IF;

  SELECT id, status
    INTO v_id, v_status
  FROM public.newsletter_subscribers
  WHERE email = v_email
    AND (
      (p_merchant_id IS NULL AND merchant_id IS NULL)
      OR (p_merchant_id IS NOT NULL AND merchant_id = p_merchant_id)
    )
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF v_status = 'unsubscribed' THEN
      UPDATE public.newsletter_subscribers
      SET
        status = 'subscribed',
        resubscribed_at = now(),
        unsubscribed_at = NULL,
        source = v_source,
        updated_at = now()
      WHERE id = v_id;
      RETURN 'resubscribed';
    END IF;

    UPDATE public.newsletter_subscribers
    SET updated_at = now()
    WHERE id = v_id;

    RETURN 'already_subscribed';
  END IF;

  INSERT INTO public.newsletter_subscribers (
    email,
    merchant_id,
    source,
    status,
    subscribed_at,
    updated_at
  ) VALUES (
    v_email,
    p_merchant_id,
    v_source,
    'subscribed',
    now(),
    now()
  );

  RETURN 'subscribed';
END;
$$;

REVOKE ALL ON FUNCTION public.subscribe_newsletter(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(
  p_email text,
  p_merchant_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_updated integer;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  UPDATE public.newsletter_subscribers
  SET
    status = 'unsubscribed',
    unsubscribed_at = now(),
    updated_at = now()
  WHERE email = v_email
    AND (
      (p_merchant_id IS NULL AND merchant_id IS NULL)
      OR (p_merchant_id IS NOT NULL AND merchant_id = p_merchant_id)
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_newsletter(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(text, uuid) TO anon, authenticated;
