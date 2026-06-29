ALTER TABLE public.receipt_claims
  ADD COLUMN IF NOT EXISTS first_click_source text,
  ADD COLUMN IF NOT EXISTS last_click_source text,
  ADD COLUMN IF NOT EXISTS first_login_started_source text,
  ADD COLUMN IF NOT EXISTS last_login_started_source text,
  ADD COLUMN IF NOT EXISTS claimed_source text,
  ADD COLUMN IF NOT EXISTS app_download_click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_app_download_clicked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_app_download_clicked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_app_download_source text,
  ADD COLUMN IF NOT EXISTS last_app_download_source text;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_click_source_valid
    CHECK (
      (first_click_source IS NULL OR first_click_source IN ('web', 'app', 'unknown'))
      AND (last_click_source IS NULL OR last_click_source IN ('web', 'app', 'unknown'))
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_login_started_source_valid
    CHECK (
      (
        first_login_started_source IS NULL
        OR first_login_started_source IN ('web', 'app', 'unknown')
      )
      AND (
        last_login_started_source IS NULL
        OR last_login_started_source IN ('web', 'app', 'unknown')
      )
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_claimed_source_valid
    CHECK (claimed_source IS NULL OR claimed_source IN ('web', 'app', 'unknown'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_app_download_click_count_nonnegative
    CHECK (app_download_click_count >= 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.receipt_claims
    ADD CONSTRAINT receipt_claims_app_download_source_valid
    CHECK (
      (
        first_app_download_source IS NULL
        OR first_app_download_source IN ('app_store', 'play_store', 'unknown')
      )
      AND (
        last_app_download_source IS NULL
        OR last_app_download_source IN ('app_store', 'play_store', 'unknown')
      )
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

UPDATE public.receipt_claims
SET first_click_source = 'web'
WHERE first_clicked_at IS NOT NULL
  AND first_click_source IS NULL;

UPDATE public.receipt_claims
SET last_click_source = 'web'
WHERE last_clicked_at IS NOT NULL
  AND last_click_source IS NULL;

UPDATE public.receipt_claims
SET first_login_started_source = 'web'
WHERE first_login_started_at IS NOT NULL
  AND first_login_started_source IS NULL;

UPDATE public.receipt_claims
SET last_login_started_source = 'web'
WHERE last_login_started_at IS NOT NULL
  AND last_login_started_source IS NULL;

UPDATE public.receipt_claims
SET claimed_source = 'web'
WHERE claimed_at IS NOT NULL
  AND claimed_source IS NULL;

CREATE OR REPLACE FUNCTION private.record_receipt_claim_click_v2(
  p_token_hash text,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source text := CASE
    WHEN lower(btrim(COALESCE(p_source, ''))) IN ('web', 'app')
      THEN lower(btrim(p_source))
    ELSE 'unknown'
  END;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN;
  END IF;

  UPDATE public.receipt_claims
  SET first_clicked_at = COALESCE(first_clicked_at, now()),
      last_clicked_at = now(),
      first_click_source = CASE
        WHEN first_clicked_at IS NULL THEN v_source
        ELSE first_click_source
      END,
      last_click_source = v_source,
      last_viewed_at = now(),
      click_count = click_count + 1,
      updated_at = now()
  WHERE token_hash = p_token_hash
    AND notification_sent_at IS NOT NULL
    AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION private.record_receipt_claim_click_v2(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_receipt_claim_click_v2(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_receipt_claim_click_v2(
  p_token_hash text,
  p_source text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.record_receipt_claim_click_v2(p_token_hash, p_source);
$$;

REVOKE ALL ON FUNCTION public.record_receipt_claim_click_v2(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_receipt_claim_click_v2(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.record_receipt_claim_login_started_v2(
  p_token_hash text,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source text := CASE
    WHEN lower(btrim(COALESCE(p_source, ''))) IN ('web', 'app')
      THEN lower(btrim(p_source))
    ELSE 'unknown'
  END;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN;
  END IF;

  UPDATE public.receipt_claims
  SET first_login_started_at = COALESCE(first_login_started_at, now()),
      last_login_started_at = now(),
      first_login_started_source = CASE
        WHEN first_login_started_at IS NULL THEN v_source
        ELSE first_login_started_source
      END,
      last_login_started_source = v_source,
      last_viewed_at = now(),
      login_started_count = login_started_count + 1,
      updated_at = now()
  WHERE token_hash = p_token_hash
    AND notification_sent_at IS NOT NULL
    AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION private.record_receipt_claim_login_started_v2(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_receipt_claim_login_started_v2(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_receipt_claim_login_started_v2(
  p_token_hash text,
  p_source text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.record_receipt_claim_login_started_v2(p_token_hash, p_source);
$$;

REVOKE ALL ON FUNCTION public.record_receipt_claim_login_started_v2(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_receipt_claim_login_started_v2(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.record_receipt_claim_app_download_clicked_v2(
  p_token_hash text,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source text := CASE
    WHEN lower(btrim(COALESCE(p_source, ''))) IN ('app_store', 'play_store')
      THEN lower(btrim(p_source))
    ELSE 'unknown'
  END;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RETURN;
  END IF;

  UPDATE public.receipt_claims
  SET first_app_download_clicked_at = COALESCE(
        first_app_download_clicked_at,
        now()
      ),
      last_app_download_clicked_at = now(),
      first_app_download_source = CASE
        WHEN first_app_download_clicked_at IS NULL THEN v_source
        ELSE first_app_download_source
      END,
      last_app_download_source = v_source,
      last_viewed_at = now(),
      app_download_click_count = app_download_click_count + 1,
      updated_at = now()
  WHERE token_hash = p_token_hash
    AND notification_sent_at IS NOT NULL
    AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION private.record_receipt_claim_app_download_clicked_v2(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_receipt_claim_app_download_clicked_v2(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_receipt_claim_app_download_clicked_v2(
  p_token_hash text,
  p_source text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.record_receipt_claim_app_download_clicked_v2(p_token_hash, p_source);
$$;

REVOKE ALL ON FUNCTION public.record_receipt_claim_app_download_clicked_v2(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_receipt_claim_app_download_clicked_v2(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.redeem_receipt_claim_v2(
  p_token_hash text,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim public.receipt_claims%ROWTYPE;
  v_customer_id uuid;
  v_source text := CASE
    WHEN lower(btrim(COALESCE(p_source, ''))) IN ('web', 'app')
      THEN lower(btrim(p_source))
    ELSE 'unknown'
  END;
  v_user_email text := lower(btrim(COALESCE(auth.jwt() ->> 'email', '')));
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT rc.* INTO v_claim
  FROM public.receipt_claims AS rc
  WHERE rc.token_hash = p_token_hash
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_claim.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_user_email = ''
    OR v_claim.customer_email IS NULL
    OR lower(btrim(v_claim.customer_email)) IS DISTINCT FROM v_user_email THEN
    RETURN jsonb_build_object('status', 'email_mismatch');
  END IF;

  IF v_claim.claimed_by_user_id IS NOT NULL
    AND v_claim.claimed_by_user_id <> v_user_id THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  UPDATE public.customers AS c
  SET user_id = v_user_id,
      last_login_at = now(),
      updated_at = now()
  WHERE c.id = v_claim.customer_id
    AND c.merchant_id = v_claim.merchant_id
    AND (c.user_id IS NULL OR c.user_id = v_user_id)
  RETURNING c.id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('status', 'customer_link_failed');
  END IF;

  UPDATE public.receipt_claims
  SET claimed_at = COALESCE(claimed_at, now()),
      claimed_by_user_id = v_user_id,
      first_clicked_at = COALESCE(first_clicked_at, now()),
      last_clicked_at = now(),
      first_click_source = CASE
        WHEN first_clicked_at IS NULL THEN v_source
        ELSE first_click_source
      END,
      last_click_source = v_source,
      claimed_source = CASE
        WHEN claimed_source IS NULL THEN v_source
        ELSE claimed_source
      END,
      last_viewed_at = now(),
      updated_at = now()
  WHERE id = v_claim.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'redirectPath', '/receipts'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.redeem_receipt_claim_v2(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.redeem_receipt_claim_v2(text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_receipt_claim_v2(
  p_token_hash text,
  p_source text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.redeem_receipt_claim_v2(p_token_hash, p_source);
$$;

REVOKE ALL ON FUNCTION public.redeem_receipt_claim_v2(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_receipt_claim_v2(text, text)
  TO authenticated;

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
      'clickedWebCount', 0,
      'clickedAppCount', 0,
      'loginStartedCount', 0,
      'loginStartedWebCount', 0,
      'loginStartedAppCount', 0,
      'claimedCount', 0,
      'claimedWebCount', 0,
      'claimedAppCount', 0,
      'appDownloadClickedCount', 0,
      'appDownloadClickCount', 0,
      'lastActivityAt', NULL,
      'recipients', '[]'::jsonb
    );
  END IF;

  IF v_caller_role <> 'service_role'
    AND NOT (
      COALESCE(public.check_staff_permission(
        (SELECT auth.uid()),
        p_merchant_id,
        'orders',
        'view'
      ), false)
      OR COALESCE(public.check_staff_permission(
        (SELECT auth.uid()),
        p_merchant_id,
        'customers',
        'view'
      ), false)
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
      'clickedWebCount', 0,
      'clickedAppCount', 0,
      'loginStartedCount', 0,
      'loginStartedWebCount', 0,
      'loginStartedAppCount', 0,
      'claimedCount', 0,
      'claimedWebCount', 0,
      'claimedAppCount', 0,
      'appDownloadClickedCount', 0,
      'appDownloadClickCount', 0,
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
      CASE
        WHEN rc.first_clicked_at IS NULL THEN NULL
        ELSE COALESCE(rc.first_click_source, 'web')
      END AS first_click_source,
      CASE
        WHEN rc.last_clicked_at IS NULL THEN NULL
        ELSE COALESCE(rc.last_click_source, rc.first_click_source, 'web')
      END AS last_click_source,
      rc.first_login_started_at,
      rc.last_login_started_at,
      rc.login_started_count,
      CASE
        WHEN rc.first_login_started_at IS NULL THEN NULL
        ELSE COALESCE(
          rc.first_login_started_source,
          'web'
        )
      END AS first_login_started_source,
      CASE
        WHEN rc.last_login_started_at IS NULL THEN NULL
        ELSE COALESCE(
          rc.last_login_started_source,
          rc.first_login_started_source,
          'web'
        )
      END AS last_login_started_source,
      rc.claimed_at,
      CASE
        WHEN rc.claimed_at IS NULL THEN NULL
        ELSE COALESCE(rc.claimed_source, 'web')
      END AS claimed_source,
      rc.first_app_download_clicked_at,
      rc.last_app_download_clicked_at,
      rc.app_download_click_count,
      CASE
        WHEN rc.first_app_download_clicked_at IS NULL THEN NULL
        ELSE COALESCE(
          rc.first_app_download_source,
          rc.last_app_download_source,
          'unknown'
        )
      END AS first_app_download_source,
      CASE
        WHEN rc.last_app_download_clicked_at IS NULL THEN NULL
        ELSE COALESCE(
          rc.last_app_download_source,
          rc.first_app_download_source,
          'unknown'
        )
      END AS last_app_download_source,
      GREATEST(
        rc.notification_sent_at,
        rc.first_clicked_at,
        rc.last_clicked_at,
        rc.first_login_started_at,
        rc.last_login_started_at,
        rc.first_app_download_clicked_at,
        rc.last_app_download_clicked_at,
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
        WHERE first_clicked_at IS NOT NULL
          AND first_click_source = 'web'
      )::integer AS clicked_web_count,
      COUNT(*) FILTER (
        WHERE first_clicked_at IS NOT NULL
          AND first_click_source = 'app'
      )::integer AS clicked_app_count,
      COUNT(*) FILTER (
        WHERE first_login_started_at IS NOT NULL
      )::integer AS login_started_count,
      COUNT(*) FILTER (
        WHERE first_login_started_at IS NOT NULL
          AND first_login_started_source = 'web'
      )::integer AS login_started_web_count,
      COUNT(*) FILTER (
        WHERE first_login_started_at IS NOT NULL
          AND first_login_started_source = 'app'
      )::integer AS login_started_app_count,
      COUNT(*) FILTER (
        WHERE claimed_at IS NOT NULL
      )::integer AS claimed_count,
      COUNT(*) FILTER (
        WHERE claimed_at IS NOT NULL
          AND claimed_source = 'web'
      )::integer AS claimed_web_count,
      COUNT(*) FILTER (
        WHERE claimed_at IS NOT NULL
          AND claimed_source = 'app'
      )::integer AS claimed_app_count,
      COUNT(*) FILTER (
        WHERE first_app_download_clicked_at IS NOT NULL
      )::integer AS app_download_clicked_count,
      COALESCE(SUM(app_download_click_count), 0)::integer
        AS app_download_click_count,
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
    'clickedWebCount', COALESCE(a.clicked_web_count, 0),
    'clickedAppCount', COALESCE(a.clicked_app_count, 0),
    'loginStartedCount', COALESCE(a.login_started_count, 0),
    'loginStartedWebCount', COALESCE(a.login_started_web_count, 0),
    'loginStartedAppCount', COALESCE(a.login_started_app_count, 0),
    'claimedCount', COALESCE(a.claimed_count, 0),
    'claimedWebCount', COALESCE(a.claimed_web_count, 0),
    'claimedAppCount', COALESCE(a.claimed_app_count, 0),
    'appDownloadClickedCount', COALESCE(a.app_download_clicked_count, 0),
    'appDownloadClickCount', COALESCE(a.app_download_click_count, 0),
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
            'firstClickSource', cr.first_click_source,
            'lastClickSource', cr.last_click_source,
            'firstLoginStartedAt', cr.first_login_started_at,
            'lastLoginStartedAt', cr.last_login_started_at,
            'loginStartedCount', cr.login_started_count,
            'firstLoginStartedSource', cr.first_login_started_source,
            'lastLoginStartedSource', cr.last_login_started_source,
            'claimedAt', cr.claimed_at,
            'claimedSource', cr.claimed_source,
            'appDownloadClickCount', cr.app_download_click_count,
            'firstAppDownloadClickedAt', cr.first_app_download_clicked_at,
            'lastAppDownloadClickedAt', cr.last_app_download_clicked_at,
            'firstAppDownloadSource', cr.first_app_download_source,
            'lastAppDownloadSource', cr.last_app_download_source
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

COMMENT ON COLUMN public.receipt_claims.first_click_source IS
  'Channel that first loaded the emailed receipt claim link: web, app, or unknown.';

COMMENT ON COLUMN public.receipt_claims.last_click_source IS
  'Most recent channel that loaded the emailed receipt claim link: web, app, or unknown.';

COMMENT ON COLUMN public.receipt_claims.first_login_started_source IS
  'Channel that first moved the recipient from the claim page into login.';

COMMENT ON COLUMN public.receipt_claims.last_login_started_source IS
  'Most recent channel that moved the recipient from the claim page into login.';

COMMENT ON COLUMN public.receipt_claims.claimed_source IS
  'Channel that successfully claimed the imported receipts: web, app, or unknown.';

COMMENT ON COLUMN public.receipt_claims.app_download_click_count IS
  'Number of app-download CTA taps recorded from the receipt claim page.';

COMMENT ON COLUMN public.receipt_claims.first_app_download_clicked_at IS
  'First time the recipient tapped an app-download CTA from the receipt claim page.';

COMMENT ON COLUMN public.receipt_claims.last_app_download_clicked_at IS
  'Most recent time the recipient tapped an app-download CTA from the receipt claim page.';

COMMENT ON COLUMN public.receipt_claims.first_app_download_source IS
  'First app-download CTA target tapped: app_store, play_store, or unknown.';

COMMENT ON COLUMN public.receipt_claims.last_app_download_source IS
  'Most recent app-download CTA target tapped: app_store, play_store, or unknown.';
