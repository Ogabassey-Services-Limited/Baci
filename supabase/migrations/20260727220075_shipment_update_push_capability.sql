ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS shipment_update_capability integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.push_tokens'::regclass
      AND conname = 'push_tokens_shipment_update_capability_check'
  ) THEN
    ALTER TABLE public.push_tokens
      ADD CONSTRAINT push_tokens_shipment_update_capability_check
      CHECK (shipment_update_capability >= 1);
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.register_push_token(text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.register_push_token(text, uuid, text, text, text, integer);

CREATE FUNCTION public.register_push_token(
  p_token text,
  p_merchant_id uuid,
  p_platform text,
  p_device_name text DEFAULT NULL,
  p_app_type text DEFAULT 'storefront',
  p_build_number integer DEFAULT NULL,
  p_shipment_update_capability integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_app_type text;
  v_token_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'register_push_token: authentication required'
      USING errcode = '42501';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) = 0
     OR p_merchant_id IS NULL
     OR p_platform IS NULL OR length(btrim(p_platform)) = 0 THEN
    RAISE EXCEPTION 'register_push_token: token, merchant_id and platform are required'
      USING errcode = '22023';
  END IF;

  IF p_shipment_update_capability IS NOT NULL
     AND p_shipment_update_capability < 1 THEN
    RAISE EXCEPTION 'register_push_token: shipment capability must be positive'
      USING errcode = '22023';
  END IF;

  v_app_type := lower(btrim(coalesce(p_app_type, 'storefront')));
  IF v_app_type NOT IN ('admin', 'storefront') THEN
    RAISE EXCEPTION 'register_push_token: invalid app type'
      USING errcode = '22023';
  END IF;

  IF v_app_type = 'admin' THEN
    IF NOT public.has_merchant_access(p_merchant_id) THEN
      RAISE EXCEPTION 'register_push_token: merchant access required'
        USING errcode = '42501';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.customers AS customer
    WHERE customer.user_id = v_uid
      AND customer.merchant_id = p_merchant_id
      AND customer.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'register_push_token: storefront customer access required'
      USING errcode = '42501';
  END IF;

  IF p_shipment_update_capability IS NULL THEN
    INSERT INTO private.push_token_compatibility_events (
      event_kind, app_type, platform, build_number,
      shipment_update_capability, occurred_at
    ) VALUES (
      'legacy_registration', v_app_type, lower(btrim(p_platform)),
      p_build_number, p_shipment_update_capability, now()
    );
  END IF;

  INSERT INTO public.push_tokens AS pt (
    user_id, merchant_id, token, platform, device_name, app_type,
    build_number, shipment_update_capability, is_active, last_used_at, updated_at,
    deactivation_reason, deactivated_at
  )
  VALUES (
    v_uid, p_merchant_id, btrim(p_token), lower(btrim(p_platform)), p_device_name,
    v_app_type, p_build_number, p_shipment_update_capability, true, now(), now(),
    NULL, NULL
  )
  ON CONFLICT (token) DO UPDATE SET
    user_id = v_uid,
    merchant_id = excluded.merchant_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_type = v_app_type,
    build_number = coalesce(excluded.build_number, pt.build_number),
    shipment_update_capability = excluded.shipment_update_capability,
    is_active = true,
    deactivation_reason = NULL,
    deactivated_at = NULL,
    last_used_at = now(),
    updated_at = now()
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

ALTER FUNCTION public.register_push_token(text, uuid, text, text, text, integer, integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, uuid, text, text, text, integer, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.stamp_legacy_push_token_logout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND OLD.is_active IS TRUE
     AND NEW.is_active IS FALSE
     AND NEW.deactivation_reason IS NOT DISTINCT FROM OLD.deactivation_reason THEN
    -- Contract: the legacy bridge records deactivation_reason = 'LegacyDirectLogout'.
    NEW.deactivation_reason := 'LegacyDirectLogout';
    NEW.deactivated_at := now();
    NEW.updated_at := now();
    INSERT INTO private.push_token_compatibility_events (
      event_kind, app_type, platform, build_number,
      shipment_update_capability, occurred_at
    ) VALUES (
      'legacy_direct_logout', lower(btrim(OLD.app_type)),
      lower(btrim(OLD.platform)), OLD.build_number,
      OLD.shipment_update_capability, now()
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.stamp_legacy_push_token_logout() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.stamp_legacy_push_token_logout()
  FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;

REVOKE INSERT, UPDATE, DELETE ON public.push_tokens FROM anon;
REVOKE INSERT, DELETE ON public.push_tokens FROM authenticated;
REVOKE UPDATE ON public.push_tokens FROM authenticated;
GRANT UPDATE (is_active) ON public.push_tokens TO authenticated;

CREATE POLICY "Users can deactivate own push token legacy"
  ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active IS TRUE)
  WITH CHECK (user_id = auth.uid() AND is_active IS FALSE);

DROP TRIGGER IF EXISTS audit_legacy_push_token_logout ON public.push_tokens;
CREATE TRIGGER audit_legacy_push_token_logout
  BEFORE UPDATE OF is_active ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_legacy_push_token_logout();

CREATE OR REPLACE FUNCTION public.deactivate_push_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'deactivate_push_token: authentication required'
      USING errcode = '42501';
  END IF;
  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RAISE EXCEPTION 'deactivate_push_token: token is required'
      USING errcode = '22023';
  END IF;

  UPDATE public.push_tokens
  SET is_active = false,
      deactivation_reason = 'UserLogout',
      deactivated_at = now(),
      updated_at = now()
  WHERE token = btrim(p_token)
    AND user_id = v_uid
    AND is_active IS TRUE;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

ALTER FUNCTION public.deactivate_push_token(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.deactivate_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_push_token(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
