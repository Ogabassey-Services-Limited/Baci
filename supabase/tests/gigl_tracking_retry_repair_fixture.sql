CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$$;

CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  statements text[] NOT NULL DEFAULT ARRAY[]::text[]
);

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  tracking_timeline_generation integer NOT NULL
);

CREATE TABLE public.gigl_tracking_sync_probe (
  result text NOT NULL
);

CREATE OR REPLACE FUNCTION private.gigl_tracking_status_rank(p_status text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
STRICT
AS $function$
  SELECT 0::smallint;
$function$;

CREATE OR REPLACE FUNCTION private.sync_gigl_tracking_order_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
      SELECT 1
      FROM public.shipments AS newer_shipment
      WHERE newer_shipment.order_id = NEW.order_id
        AND newer_shipment.tracking_timeline_generation
          > NEW.tracking_timeline_generation
  ) THEN
    INSERT INTO public.gigl_tracking_sync_probe(result) VALUES ('blocked');
  ELSE
    INSERT INTO public.gigl_tracking_sync_probe(result) VALUES ('allowed');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.activate_gigl_tracking_monitor()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_gigl_tracking_result(
  p_order_id uuid,
  p_shipment_id uuid,
  p_status text,
  p_tracking_number text,
  p_provider text,
  p_actual_delivery timestamptz,
  p_events jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_status text := 'failed';
  v_latest_status_event_at timestamptz := now();
  v_latest_persisted_event_at timestamptz;
  v_latest_persisted_status_event_at timestamptz;
  v_manual_terminal_override_at timestamptz := now();
  v_latest_incoming_event_at timestamptz := now();
  v_effective_status text;
  v_current_location text;
  v_should_update_location boolean := false;
  v_should_update_delivery boolean := false;
BEGIN
  v_effective_status := CASE
    WHEN private.gigl_tracking_status_rank(p_status)
      < private.gigl_tracking_status_rank(coalesce(v_current_status, 'pending'))
      THEN v_current_status
    ELSE p_status
  END;
  v_should_update_location := v_current_location IS NOT NULL
    AND true;
  IF v_effective_status IN ('delivered', 'cancelled', 'returned') THEN
    v_should_update_location := false;
  END IF;
  v_should_update_delivery := p_actual_delivery IS NOT NULL;
  RETURN jsonb_build_object(
    'effective_status', v_effective_status,
    'should_update_delivery', v_should_update_delivery
  );
END;
$function$;

INSERT INTO public.shipments(id, order_id, merchant_id, tracking_timeline_generation)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  2
);

CREATE TRIGGER gigl_tracking_sync_probe_trigger
BEFORE INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION private.sync_gigl_tracking_order_status();
