ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS result_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_jobs_storefront_generation_queue
  ON public.ai_jobs (status, next_run_at, lease_expires_at, created_at)
  WHERE type = 'storefront_layout_generation';

CREATE INDEX IF NOT EXISTS idx_ai_jobs_merchant_type_created_at
  ON public.ai_jobs (merchant_id, type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_storefront_active_idempotency
  ON public.ai_jobs (merchant_id, type, idempotency_key)
  WHERE type = 'storefront_layout_generation'
    AND idempotency_key IS NOT NULL
    AND status IN ('pending', 'processing', 'completed');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_jobs'
      AND policyname = 'Staff can view storefront generation jobs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Staff can view storefront generation jobs"
        ON public.ai_jobs
        FOR SELECT
        TO authenticated
        USING (
          type = 'storefront_layout_generation'
          AND (
            EXISTS (
              SELECT 1
              FROM public.merchants m
              WHERE m.id = ai_jobs.merchant_id
                AND m.user_id = (SELECT auth.uid())
            )
            OR public.check_staff_permission(
              (SELECT auth.uid()),
              merchant_id,
              'builder',
              'view'
            )
            OR public.check_staff_permission(
              (SELECT auth.uid()),
              merchant_id,
              'builder',
              'edit'
            )
          )
        )
    $policy$;
  END IF;
END;
$$;

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
  v_page_config_id uuid;
  v_current_updated_at timestamptz;
  v_next_updated_at timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN QUERY SELECT false, 'unauthorized'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = p_merchant_id
        AND m.user_id = v_actor_id
    )
    OR public.check_staff_permission(v_actor_id, p_merchant_id, 'builder', 'edit')
    INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN QUERY SELECT false, 'forbidden'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT id
    INTO v_job_id
    FROM public.ai_jobs
    WHERE id = p_job_id
      AND merchant_id = p_merchant_id
      AND type = 'storefront_layout_generation'
      AND status = 'completed'
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'job_not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT id, updated_at
    INTO v_page_config_id, v_current_updated_at
    FROM public.page_configs
    WHERE merchant_id = p_merchant_id
      AND page_slug = p_page_slug
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'page_config_not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT p_force AND v_current_updated_at IS DISTINCT FROM p_generated_against_updated_at THEN
    RETURN QUERY SELECT false, 'ai_draft_stale'::text, v_page_config_id, v_current_updated_at;
    RETURN;
  END IF;

  UPDATE public.page_configs
    SET draft_config = p_generated_config,
        updated_at = clock_timestamp()
    WHERE id = v_page_config_id
    RETURNING page_configs.updated_at INTO v_next_updated_at;

  UPDATE public.ai_jobs
    SET result_applied_at = clock_timestamp(),
        metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object('lastAppliedPageConfigUpdatedAt', v_next_updated_at)
    WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI storefront job % was not found while marking applied', p_job_id;
  END IF;

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

COMMENT ON COLUMN public.ai_jobs.attempts IS
  'Number of processing attempts for retryable background AI jobs.';

COMMENT ON COLUMN public.ai_jobs.max_attempts IS
  'Maximum processing attempts before a background AI job is marked failed.';

COMMENT ON COLUMN public.ai_jobs.next_run_at IS
  'Earliest time a pending background AI job may be claimed by a worker.';

COMMENT ON COLUMN public.ai_jobs.model IS
  'AI model used or requested for this job.';

COMMENT ON COLUMN public.ai_jobs.result_applied_at IS
  'Time the generated result was applied to a merchant draft, if ever.';

COMMENT ON COLUMN public.ai_jobs.locked_at IS
  'Time a worker claimed this job.';

COMMENT ON COLUMN public.ai_jobs.locked_by IS
  'Identifier for the worker currently processing this job.';

COMMENT ON COLUMN public.ai_jobs.lease_expires_at IS
  'Time after which a stuck processing job can be reclaimed.';

COMMENT ON COLUMN public.ai_jobs.idempotency_key IS
  'Deduplication key for job creators such as onboarding.';

COMMENT ON COLUMN public.ai_jobs.metadata IS
  'Non-authoritative processing metadata such as latency, validation notes, and conflict status.';
