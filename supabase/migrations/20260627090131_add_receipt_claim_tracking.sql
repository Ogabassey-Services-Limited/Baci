-- disable-transaction

ALTER TABLE public.receipt_claims
  ADD COLUMN IF NOT EXISTS first_clicked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_login_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_login_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS login_started_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_click_count_nonnegative
    CHECK (click_count >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_login_started_count_nonnegative
    CHECK (login_started_count >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipt_claims_campaign_activity
  ON public.receipt_claims (
    merchant_id,
    import_job_id,
    notification_sent_at,
    first_clicked_at,
    claimed_at
  );

CREATE OR REPLACE FUNCTION private.record_receipt_claim_click(
  p_token_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN;
  END IF;

  UPDATE public.receipt_claims
  SET first_clicked_at = COALESCE(first_clicked_at, now()),
      last_clicked_at = now(),
      last_viewed_at = now(),
      click_count = click_count + 1,
      updated_at = now()
  WHERE token_hash = p_token_hash
    AND notification_sent_at IS NOT NULL
    AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION private.record_receipt_claim_click(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_receipt_claim_click(
  p_token_hash text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.record_receipt_claim_click(p_token_hash);
$$;

REVOKE ALL ON FUNCTION public.record_receipt_claim_click(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_receipt_claim_click(text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.record_receipt_claim_login_started(
  p_token_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN;
  END IF;

  UPDATE public.receipt_claims
  SET first_login_started_at = COALESCE(first_login_started_at, now()),
      last_login_started_at = now(),
      last_viewed_at = now(),
      login_started_count = login_started_count + 1,
      updated_at = now()
  WHERE token_hash = p_token_hash
    AND notification_sent_at IS NOT NULL
    AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION private.record_receipt_claim_login_started(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_receipt_claim_login_started(
  p_token_hash text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.record_receipt_claim_login_started(p_token_hash);
$$;

REVOKE ALL ON FUNCTION public.record_receipt_claim_login_started(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_receipt_claim_login_started(text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_receipt_claim_campaign_stats(
  p_merchant_id uuid,
  p_import_job_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
  v_result jsonb;
BEGIN
  IF p_merchant_id IS NULL OR p_import_job_id IS NULL THEN
    RETURN jsonb_build_object(
      'totalRecipients', 0,
      'sentCount', 0,
      'clickedCount', 0,
      'loginStartedCount', 0,
      'claimedCount', 0,
      'lastActivityAt', NULL,
      'recipients', '[]'::jsonb
    );
  END IF;

  IF v_caller_role <> 'service_role'
    AND NOT (
      public.check_staff_permission(
        (SELECT auth.uid()),
        p_merchant_id,
        'orders',
        'view'
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()),
        p_merchant_id,
        'customers',
        'view'
      )
    ) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.import_jobs AS ij
    WHERE ij.id = p_import_job_id
      AND ij.merchant_id = p_merchant_id
  ) THEN
    RETURN jsonb_build_object(
      'totalRecipients', 0,
      'sentCount', 0,
      'clickedCount', 0,
      'loginStartedCount', 0,
      'claimedCount', 0,
      'lastActivityAt', NULL,
      'recipients', '[]'::jsonb
    );
  END IF;

  WITH claim_rows AS (
    SELECT
      rc.id,
      rc.customer_email,
      rc.customer_name,
      rc.notification_sent_at,
      rc.first_clicked_at,
      rc.last_clicked_at,
      rc.click_count,
      rc.first_login_started_at,
      rc.last_login_started_at,
      rc.login_started_count,
      rc.claimed_at,
      GREATEST(
        rc.notification_sent_at,
        rc.first_clicked_at,
        rc.last_clicked_at,
        rc.first_login_started_at,
        rc.last_login_started_at,
        rc.claimed_at,
        rc.last_viewed_at
      ) AS last_activity_at
    FROM public.receipt_claims AS rc
    WHERE rc.merchant_id = p_merchant_id
      AND rc.import_job_id = p_import_job_id
  ),
  aggregate_stats AS (
    SELECT
      COUNT(*)::integer AS total_recipients,
      COUNT(*) FILTER (
        WHERE notification_sent_at IS NOT NULL
      )::integer AS sent_count,
      COUNT(*) FILTER (
        WHERE first_clicked_at IS NOT NULL
      )::integer AS clicked_count,
      COUNT(*) FILTER (
        WHERE first_login_started_at IS NOT NULL
      )::integer AS login_started_count,
      COUNT(*) FILTER (
        WHERE claimed_at IS NOT NULL
      )::integer AS claimed_count,
      MAX(last_activity_at) AS last_activity_at
    FROM claim_rows
  ),
  recipient_rows AS (
    SELECT *
    FROM claim_rows
    ORDER BY last_activity_at DESC NULLS LAST, lower(customer_email)
    LIMIT 200
  )
  SELECT jsonb_build_object(
    'totalRecipients', COALESCE(a.total_recipients, 0),
    'sentCount', COALESCE(a.sent_count, 0),
    'clickedCount', COALESCE(a.clicked_count, 0),
    'loginStartedCount', COALESCE(a.login_started_count, 0),
    'claimedCount', COALESCE(a.claimed_count, 0),
    'lastActivityAt', a.last_activity_at,
    'recipients', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', cr.id,
            'customerEmail', cr.customer_email,
            'customerName', cr.customer_name,
            'notificationSentAt', cr.notification_sent_at,
            'firstClickedAt', cr.first_clicked_at,
            'lastClickedAt', cr.last_clicked_at,
            'clickCount', cr.click_count,
            'firstLoginStartedAt', cr.first_login_started_at,
            'lastLoginStartedAt', cr.last_login_started_at,
            'loginStartedCount', cr.login_started_count,
            'claimedAt', cr.claimed_at
          )
          ORDER BY cr.last_activity_at DESC NULLS LAST, lower(cr.customer_email)
        )
        FROM recipient_rows AS cr
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM aggregate_stats AS a;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_receipt_claim_campaign_stats(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_receipt_claim_campaign_stats(uuid, uuid)
  TO authenticated, service_role;

COMMENT ON COLUMN public.receipt_claims.first_clicked_at IS
  'First time the emailed receipt claim link successfully loaded a claim preview.';

COMMENT ON COLUMN public.receipt_claims.last_clicked_at IS
  'Most recent time the emailed receipt claim link successfully loaded a claim preview.';

COMMENT ON COLUMN public.receipt_claims.click_count IS
  'Number of successful receipt claim preview loads recorded for the emailed link.';

COMMENT ON COLUMN public.receipt_claims.first_login_started_at IS
  'First time the recipient moved from the receipt claim page into the login flow.';

COMMENT ON COLUMN public.receipt_claims.last_login_started_at IS
  'Most recent time the recipient moved from the receipt claim page into the login flow.';

COMMENT ON COLUMN public.receipt_claims.login_started_count IS
  'Number of times the recipient moved from the receipt claim page into the login flow.';
