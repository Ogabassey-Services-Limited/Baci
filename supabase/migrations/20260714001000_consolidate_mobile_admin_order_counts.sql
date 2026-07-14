-- Replace eight parallel exact-count requests in the mobile admin with one
-- tenant-authorized aggregate. The definer function deliberately bypasses the
-- per-row orders RLS helper only after checking merchant access once.

CREATE OR REPLACE FUNCTION public.get_mobile_admin_order_counts(
  p_merchant_id uuid,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text := COALESCE((SELECT auth.role()), '');
  v_counts jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  -- Match the current orders RLS: active merchant membership is sufficient;
  -- granular staff permissions such as orders.view are intentionally not read.
  IF v_caller_role <> 'service_role'
    AND public.has_merchant_access(p_merchant_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  -- Keep all-branch and branch-scoped statements in separate PL/pgSQL plan
  -- caches. A nullable OR predicate can settle on a merchant-only generic plan
  -- after all-branch calls and then scan every branch for scoped requests.
  IF p_branch_id IS NULL THEN
    SELECT pg_catalog.jsonb_build_object(
      'all', COUNT(*),
      'paid', COUNT(*) FILTER (WHERE orders.payment_status = 'paid'),
      'pending', COUNT(*) FILTER (WHERE orders.shipping_status = 'pending'),
      'processing', COUNT(*) FILTER (WHERE orders.shipping_status = 'processing'),
      'shipped', COUNT(*) FILTER (WHERE orders.shipping_status = 'shipped'),
      'delivered', COUNT(*) FILTER (WHERE orders.shipping_status = 'delivered'),
      'cancelled', COUNT(*) FILTER (WHERE orders.shipping_status = 'cancelled'),
      'returned', COUNT(*) FILTER (WHERE orders.shipping_status = 'returned')
    )
    INTO v_counts
    FROM public.orders AS orders
    WHERE orders.merchant_id = p_merchant_id
      AND orders.payment_status NOT IN ('bnpl_pending', 'failed', 'expired')
      AND (
        orders.payment_status NOT IN ('pending', 'unpaid')
        OR orders.payment_method IS NULL
        OR orders.payment_method NOT IN (
          'paystack',
          'korapay',
          'bank_transfer',
          'credit_direct',
          'credpal',
          'klump',
          'juicyway'
        )
      );
  ELSE
    SELECT pg_catalog.jsonb_build_object(
      'all', COUNT(*),
      'paid', COUNT(*) FILTER (WHERE orders.payment_status = 'paid'),
      'pending', COUNT(*) FILTER (WHERE orders.shipping_status = 'pending'),
      'processing', COUNT(*) FILTER (WHERE orders.shipping_status = 'processing'),
      'shipped', COUNT(*) FILTER (WHERE orders.shipping_status = 'shipped'),
      'delivered', COUNT(*) FILTER (WHERE orders.shipping_status = 'delivered'),
      'cancelled', COUNT(*) FILTER (WHERE orders.shipping_status = 'cancelled'),
      'returned', COUNT(*) FILTER (WHERE orders.shipping_status = 'returned')
    )
    INTO v_counts
    FROM public.orders AS orders
    WHERE orders.merchant_id = p_merchant_id
      AND orders.branch_id = p_branch_id
      AND orders.payment_status NOT IN ('bnpl_pending', 'failed', 'expired')
      AND (
        orders.payment_status NOT IN ('pending', 'unpaid')
        OR orders.payment_method IS NULL
        OR orders.payment_method NOT IN (
          'paystack',
          'korapay',
          'bank_transfer',
          'credit_direct',
          'credpal',
          'klump',
          'juicyway'
        )
      );
  END IF;

  RETURN v_counts;
END;
$$;

ALTER FUNCTION public.get_mobile_admin_order_counts(uuid, uuid)
  OWNER TO postgres;

COMMENT ON FUNCTION public.get_mobile_admin_order_counts(uuid, uuid) IS
  'Returns branch-scoped visible mobile-admin order counts after one merchant-access check.';

REVOKE ALL ON FUNCTION public.get_mobile_admin_order_counts(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mobile_admin_order_counts(uuid, uuid)
  TO authenticated, service_role;
