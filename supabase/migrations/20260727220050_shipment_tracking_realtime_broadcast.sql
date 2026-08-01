-- Private, payload-free wakeups let clients refetch an authorized snapshot.

CREATE OR REPLACE FUNCTION private.emit_shipment_tracking_wakeup(
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_realtime_rls_enabled boolean;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  SELECT relation.relrowsecurity
  INTO v_realtime_rls_enabled
  FROM pg_catalog.pg_class AS relation
  INNER JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'realtime'
    AND relation.relname = 'messages';

  IF v_realtime_rls_enabled IS DISTINCT FROM true
     OR pg_catalog.to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'GIGL_TRACKING_REALTIME_UNAVAILABLE'
      USING ERRCODE = '55000';
  END IF;

  PERFORM realtime.send(
    '{}'::jsonb,
    'shipment_tracking_changed',
    'order-tracking:' || p_order_id::text,
    true
  );
END;
$$;

ALTER FUNCTION private.emit_shipment_tracking_wakeup(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.emit_shipment_tracking_wakeup(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.broadcast_shipment_tracking_wakeup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_old_order_id uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.order_id END;
  v_new_order_id uuid := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.order_id END;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id
     AND NEW.tracking_snapshot_version IS NOT DISTINCT FROM OLD.tracking_snapshot_version THEN
    RETURN NULL;
  END IF;

  IF v_old_order_id IS NOT NULL
     AND v_old_order_id IS DISTINCT FROM v_new_order_id THEN
    BEGIN
      PERFORM private.emit_shipment_tracking_wakeup(v_old_order_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'SHIPMENT_TRACKING_BROADCAST_FAILED sqlstate=%', SQLSTATE;
    END;
  END IF;

  IF v_new_order_id IS NOT NULL THEN
    BEGIN
      PERFORM private.emit_shipment_tracking_wakeup(v_new_order_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'SHIPMENT_TRACKING_BROADCAST_FAILED sqlstate=%', SQLSTATE;
    END;
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION private.broadcast_shipment_tracking_wakeup() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.broadcast_shipment_tracking_wakeup() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS broadcast_shipment_tracking_wakeup ON public.shipments;
CREATE TRIGGER broadcast_shipment_tracking_wakeup
AFTER INSERT OR UPDATE OR DELETE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.broadcast_shipment_tracking_wakeup();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    INNER JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'realtime'
      AND relation.relname = 'messages'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'GIGL_TRACKING_REALTIME_UNAVAILABLE'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables AS publication_table
    WHERE publication_table.pubname = 'supabase_realtime'
      AND publication_table.schemaname = 'public'
      AND publication_table.tablename = 'shipments'
  ) THEN
    RAISE EXCEPTION 'GIGL_TRACKING_SHIPMENTS_PUBLICATION_CONFLICT'
      USING ERRCODE = '55000';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "authorized users receive shipment tracking wakeups" ON realtime.messages;
DROP POLICY IF EXISTS "shipment tracking topics require order access" ON realtime.messages;
DROP POLICY IF EXISTS "shipment tracking topics reject client sends" ON realtime.messages;

CREATE POLICY "authorized users receive shipment tracking wakeups"
  ON realtime.messages
  AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() ~ '^order-tracking:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.orders AS tracked_order
      WHERE tracked_order.id = pg_catalog.substring(realtime.topic() FROM 16)::uuid
        AND (
          public.has_merchant_access(tracked_order.merchant_id)
          OR EXISTS (
            SELECT 1
            FROM public.customers AS customer
            WHERE customer.id = tracked_order.customer_id
              AND customer.user_id = auth.uid()
              AND customer.merchant_id = tracked_order.merchant_id
              AND customer.deleted_at IS NULL
          )
        )
    )
  );

CREATE POLICY "shipment tracking topics require order access"
  ON realtime.messages
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    realtime.topic() !~ '^order-tracking:'
    OR (
      realtime.messages.extension = 'broadcast'
      AND realtime.topic() ~ '^order-tracking:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
      SELECT 1
      FROM public.orders AS tracked_order
      WHERE tracked_order.id = pg_catalog.substring(realtime.topic() FROM 16)::uuid
        AND (
          public.has_merchant_access(tracked_order.merchant_id)
          OR EXISTS (
            SELECT 1
            FROM public.customers AS customer
            WHERE customer.id = tracked_order.customer_id
              AND customer.user_id = auth.uid()
              AND customer.merchant_id = tracked_order.merchant_id
              AND customer.deleted_at IS NULL
          )
        )
      )
    )
  );

CREATE POLICY "shipment tracking topics reject client sends"
  ON realtime.messages
  AS RESTRICTIVE
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    realtime.topic() !~ '^order-tracking:'
  );
