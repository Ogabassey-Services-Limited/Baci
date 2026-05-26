CREATE OR REPLACE FUNCTION public.apply_ai_storefront_draft(
  p_job_id uuid,
  p_merchant_id uuid,
  p_page_slug text,
  p_generated_config jsonb,
  p_generated_against_updated_at timestamptz,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  applied boolean,
  code text,
  page_config_id uuid,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_authorized boolean := false;
  v_job_id uuid;
  v_result_applied_at timestamptz;
  v_page_config_id uuid;
  v_current_updated_at timestamptz;
  v_next_updated_at timestamptz;
  v_apply_timestamp timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN QUERY SELECT false, 'unauthorized'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM public.merchants AS m
      WHERE m.id = p_merchant_id
        AND m.user_id = v_actor_id
    )
    OR public.check_staff_permission(v_actor_id, p_merchant_id, 'builder', 'edit')
    INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN QUERY SELECT false, 'forbidden'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT j.id, j.result_applied_at
    INTO v_job_id, v_result_applied_at
    FROM public.ai_jobs AS j
    WHERE j.id = p_job_id
      AND j.merchant_id = p_merchant_id
      AND j.type = 'storefront_layout_generation'
      AND j.status = 'completed'
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'job_not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_result_applied_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'job_already_applied'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT pc.id, pc.updated_at
    INTO v_page_config_id, v_current_updated_at
    FROM public.page_configs AS pc
    WHERE pc.merchant_id = p_merchant_id
      AND pc.page_slug = p_page_slug
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'page_config_not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT p_force AND v_current_updated_at IS DISTINCT FROM p_generated_against_updated_at THEN
    RETURN QUERY SELECT false, 'ai_draft_stale'::text, v_page_config_id, v_current_updated_at;
    RETURN;
  END IF;

  v_apply_timestamp := clock_timestamp();

  UPDATE public.page_configs AS pc
    SET draft_config = p_generated_config,
        updated_at = v_apply_timestamp
    WHERE pc.id = v_page_config_id
    RETURNING pc.updated_at INTO v_next_updated_at;

  UPDATE public.ai_jobs AS j
    SET result_applied_at = v_apply_timestamp,
        metadata = COALESCE(j.metadata, '{}'::jsonb)
          || jsonb_build_object('lastAppliedPageConfigUpdatedAt', v_next_updated_at)
    WHERE j.id = p_job_id;

  RETURN QUERY SELECT true, NULL::text, v_page_config_id, v_next_updated_at;
END;
$$;

ALTER FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) TO authenticated;
