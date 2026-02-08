-- Migration: Newsletter subscribe/unsubscribe RPCs
-- Created: 2026-02-06
-- Description: Allow public subscribe/unsubscribe without service role usage

CREATE OR REPLACE FUNCTION public.subscribe_newsletter(
  p_email TEXT,
  p_merchant_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'widget'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_id UUID;
  v_status TEXT;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  SELECT id, status
    INTO v_id, v_status
  FROM newsletter_subscribers
  WHERE email = v_email
    AND (
      (p_merchant_id IS NULL AND merchant_id IS NULL)
      OR (p_merchant_id IS NOT NULL AND merchant_id = p_merchant_id)
    )
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF v_status = 'unsubscribed' THEN
      UPDATE newsletter_subscribers
      SET
        status = 'subscribed',
        resubscribed_at = NOW(),
        source = p_source
      WHERE id = v_id;
      RETURN 'resubscribed';
    END IF;

    RETURN 'already_subscribed';
  END IF;

  INSERT INTO newsletter_subscribers (
    email,
    merchant_id,
    source,
    status,
    subscribed_at
  ) VALUES (
    v_email,
    p_merchant_id,
    p_source,
    'subscribed',
    NOW()
  );

  RETURN 'subscribed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(TEXT, UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(
  p_email TEXT,
  p_merchant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_updated INT;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  UPDATE newsletter_subscribers
  SET
    status = 'unsubscribed',
    unsubscribed_at = NOW()
  WHERE email = v_email
    AND (
      (p_merchant_id IS NULL AND merchant_id IS NULL)
      OR (p_merchant_id IS NOT NULL AND merchant_id = p_merchant_id)
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(TEXT, UUID) TO anon, authenticated;
