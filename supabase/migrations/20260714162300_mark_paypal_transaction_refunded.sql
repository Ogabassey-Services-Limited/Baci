-- Atomically terminalize a PayPal capture after its refund has completed or
-- entered PayPal's asynchronous PENDING state. The prior application flow read
-- metadata and updated status in separate statements, so concurrent writers
-- could lose reconciliation keys or leave the capture settleable.

CREATE OR REPLACE FUNCTION public.mark_paypal_transaction_refunded(
  p_transaction_id uuid,
  p_status text,
  p_pending_refund_ids text[] DEFAULT ARRAY[]::text[],
  p_restore_prepaid_on_reconcile boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata jsonb;
  v_updated_rows bigint;
BEGIN
  IF p_transaction_id IS NULL THEN
    RAISE EXCEPTION 'transaction id is required' USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('refund_pending', 'refunded') THEN
    RAISE EXCEPTION 'unsupported refund status' USING ERRCODE = '22023';
  END IF;

  SELECT t.metadata
  INTO v_metadata
  FROM public.transactions AS t
  WHERE t.id = p_transaction_id
    AND (
      (
        p_status = 'refund_pending'
        AND t.status IN ('pending', 'completed')
      )
      OR (
        p_status = 'refunded'
        AND t.status IN ('pending', 'completed', 'refund_pending')
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_status = 'refund_pending' THEN
    v_metadata := COALESCE(v_metadata, '{}'::jsonb)
      || pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'paypal_pending_refund_ids',
            CASE
              WHEN pg_catalog.cardinality(p_pending_refund_ids) > 0
                THEN pg_catalog.to_jsonb(p_pending_refund_ids)
              ELSE NULL::jsonb
            END,
          'paypal_restore_prepaid_on_refund_reconcile',
            CASE
              WHEN p_restore_prepaid_on_reconcile THEN true
              ELSE NULL::boolean
            END
        )
      );
  END IF;

  UPDATE public.transactions AS t
  SET
    status = p_status,
    metadata = v_metadata,
    updated_at = pg_catalog.now()
  WHERE t.id = p_transaction_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RETURN v_updated_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_paypal_transaction_refunded(uuid, text, text[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_paypal_transaction_refunded(uuid, text, text[], boolean)
  TO service_role;

COMMENT ON FUNCTION public.mark_paypal_transaction_refunded(uuid, text, text[], boolean) IS
  'Atomically locks and terminalizes a refunded PayPal capture while merging pending-reconciliation metadata.';
