-- Service-only worker heartbeat state for queue and delivery SLO monitoring.

CREATE TABLE IF NOT EXISTS public.event_pipeline_worker_heartbeats (
  worker_name text PRIMARY KEY,
  worker_id text NOT NULL,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  processed_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_pipeline_worker_heartbeats_name_check
    CHECK (length(worker_name) BETWEEN 1 AND 100),
  CONSTRAINT event_pipeline_worker_heartbeats_id_check
    CHECK (length(worker_id) BETWEEN 1 AND 200),
  CONSTRAINT event_pipeline_worker_heartbeats_count_check
    CHECK (processed_count >= 0)
);

ALTER TABLE public.event_pipeline_worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_pipeline_worker_heartbeats FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_pipeline_worker_heartbeats
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.event_pipeline_worker_heartbeats TO service_role;

DROP POLICY IF EXISTS event_pipeline_worker_heartbeats_service_all
  ON public.event_pipeline_worker_heartbeats;
CREATE POLICY event_pipeline_worker_heartbeats_service_all
  ON public.event_pipeline_worker_heartbeats FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_event_worker_heartbeat_v1(
  p_worker_name text,
  p_worker_id text,
  p_status text,
  p_processed_count integer DEFAULT 0,
  p_error_code text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '2s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_event_worker_heartbeat_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('started', 'succeeded', 'failed') THEN
    RAISE EXCEPTION 'invalid_worker_heartbeat_status'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_pipeline_worker_heartbeats AS heartbeat (
    worker_name,
    worker_id,
    last_started_at,
    last_succeeded_at,
    last_error_at,
    last_error_code,
    processed_count,
    updated_at
  ) VALUES (
    p_worker_name,
    p_worker_id,
    CASE WHEN p_status = 'started' THEN now() END,
    CASE WHEN p_status = 'succeeded' THEN now() END,
    CASE WHEN p_status = 'failed' THEN now() END,
    CASE WHEN p_status = 'failed' THEN left(p_error_code, 100) END,
    GREATEST(p_processed_count, 0),
    now()
  )
  ON CONFLICT (worker_name) DO UPDATE
  SET
    worker_id = EXCLUDED.worker_id,
    last_started_at = COALESCE(EXCLUDED.last_started_at, heartbeat.last_started_at),
    last_succeeded_at = COALESCE(
      EXCLUDED.last_succeeded_at,
      heartbeat.last_succeeded_at
    ),
    last_error_at = COALESCE(EXCLUDED.last_error_at, heartbeat.last_error_at),
    last_error_code = CASE
      WHEN p_status = 'failed' THEN EXCLUDED.last_error_code
      WHEN p_status = 'succeeded' THEN NULL
      ELSE heartbeat.last_error_code
    END,
    processed_count = heartbeat.processed_count + GREATEST(p_processed_count, 0),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_event_worker_heartbeat_v1(
  text, text, text, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_event_worker_heartbeat_v1(
  text, text, text, integer, text
) TO service_role;
