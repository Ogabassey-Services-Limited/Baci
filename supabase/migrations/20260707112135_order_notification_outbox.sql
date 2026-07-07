-- Transactional outbox for order fulfillment emails.
-- The order status update commits first; this table is drained asynchronously by
-- /api/cron/order-notifications so provider failures cannot roll back shipping
-- or delivery transitions.

CREATE TABLE IF NOT EXISTS public.order_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('order_shipped', 'order_delivered')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  skip_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_notification_outbox_unique_event UNIQUE (order_id, event_type)
);

ALTER TABLE public.order_notification_outbox ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notification_outbox TO service_role;

DROP POLICY IF EXISTS order_notification_outbox_deny_public ON public.order_notification_outbox;
CREATE POLICY order_notification_outbox_deny_public
  ON public.order_notification_outbox
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_order_notification_outbox_ready
  ON public.order_notification_outbox (status, next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_order_notification_outbox_processing_stale
  ON public.order_notification_outbox (locked_at, created_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_order_notification_outbox_order_id
  ON public.order_notification_outbox (order_id);

CREATE INDEX IF NOT EXISTS idx_order_notification_outbox_merchant_id
  ON public.order_notification_outbox (merchant_id);

COMMENT ON TABLE public.order_notification_outbox IS
  'Transactional outbox for order fulfillment notification emails. Claimed by the VPS-backed order-notifications cron.';
COMMENT ON COLUMN public.order_notification_outbox.event_type IS
  'Fulfillment event to process: order_shipped or order_delivered.';
COMMENT ON COLUMN public.order_notification_outbox.status IS
  'pending/processing rows are claimable; sent/skipped/failed are terminal.';

CREATE OR REPLACE FUNCTION public.enqueue_order_fulfillment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status IS NOT DISTINCT FROM OLD.shipping_status THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status = 'shipped' THEN
    v_event_type := 'order_shipped';
  ELSIF NEW.shipping_status = 'delivered' THEN
    v_event_type := 'order_delivered';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.order_notification_outbox (
    order_id,
    merchant_id,
    event_type,
    next_attempt_at,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.merchant_id,
    v_event_type,
    now(),
    jsonb_build_object(
      'previous_shipping_status', OLD.shipping_status,
      'shipping_status', NEW.shipping_status,
      'source', 'orders_shipping_status_trigger'
    )
  )
  ON CONFLICT (order_id, event_type) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_fulfillment_notification() FROM PUBLIC;

DROP TRIGGER IF EXISTS orders_enqueue_fulfillment_notification ON public.orders;
CREATE TRIGGER orders_enqueue_fulfillment_notification
  AFTER UPDATE OF shipping_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_order_fulfillment_notification();

CREATE OR REPLACE FUNCTION public.claim_order_notification_outbox(
  p_batch_size integer DEFAULT 25,
  p_worker_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  merchant_id uuid,
  event_type text,
  attempt_count integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 25), 100));
  v_worker_id text := coalesce(nullif(btrim(p_worker_id), ''), 'order-notifications-worker');
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT outbox.id
    FROM public.order_notification_outbox AS outbox
    WHERE (
        outbox.status = 'pending'
        AND outbox.attempt_count < outbox.max_attempts
        AND coalesce(outbox.next_attempt_at, now()) <= now()
      )
      OR (
        outbox.status = 'processing'
        AND outbox.attempt_count < outbox.max_attempts
        AND outbox.locked_at < now() - interval '15 minutes'
      )
    ORDER BY outbox.created_at ASC
    LIMIT v_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.order_notification_outbox AS outbox
  SET
    status = 'processing',
    locked_at = now(),
    locked_by = v_worker_id,
    attempt_count = outbox.attempt_count + 1,
    updated_at = now()
  FROM candidates
  WHERE outbox.id = candidates.id
  RETURNING
    outbox.id,
    outbox.order_id,
    outbox.merchant_id,
    outbox.event_type,
    outbox.attempt_count,
    outbox.max_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_notification_outbox(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_notification_outbox(integer, text) TO service_role;

COMMENT ON FUNCTION public.claim_order_notification_outbox(integer, text) IS
  'Atomically claims pending order fulfillment notification outbox rows using FOR UPDATE SKIP LOCKED.';
