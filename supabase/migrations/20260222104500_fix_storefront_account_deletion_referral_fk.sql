-- Follow-up fix for storefront account deletion:
-- 1) Avoid FK violations on customer_loyalty.referred_by_customer_id
-- 2) Explicitly nullify orders.customer_id before customer deletion
-- 3) Defensively handle audit_logs to prevent FK violations on auth.users
-- 4) Keep deletion behavior deterministic while retaining order records

CREATE OR REPLACE FUNCTION public.delete_current_storefront_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_push_tokens_deleted INTEGER := 0;
  v_wishlist_deleted INTEGER := 0;
  v_customers_deleted INTEGER := 0;
  v_auth_users_deleted INTEGER := 0;
  v_referrals_detached INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT LOWER(email)
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR LENGTH(TRIM(v_email)) = 0 THEN
    RAISE EXCEPTION 'Account email not found';
  END IF;

  -- Remove push token registrations linked to this auth user.
  DELETE FROM public.push_tokens
  WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_push_tokens_deleted = ROW_COUNT;

  -- Remove storefront wishlist rows for this account email.
  DELETE FROM public.wish_list_items
  WHERE LOWER(customer_email) = v_email;
  GET DIAGNOSTICS v_wishlist_deleted = ROW_COUNT;

  -- Detach referrals before deleting customer rows to avoid FK failures.
  IF to_regclass('public.customer_loyalty') IS NOT NULL THEN
    UPDATE public.customer_loyalty
    SET referred_by_customer_id = NULL
    WHERE referred_by_customer_id IN (
      SELECT id
      FROM public.customers
      WHERE user_id = v_user_id
    );
    GET DIAGNOSTICS v_referrals_detached = ROW_COUNT;
  END IF;

  -- Explicitly nullify order references before removing customer rows.
  -- orders.customer_id has ON DELETE SET NULL, but we do this explicitly as a
  -- safety measure to guarantee deterministic behaviour regardless of FK timing.
  UPDATE public.orders
  SET customer_id = NULL
  WHERE customer_id IN (
    SELECT id FROM public.customers WHERE user_id = v_user_id
  );

  -- Remove storefront customer profile rows linked to this auth user.
  -- Orders are retained with customer_id = NULL (set above).
  DELETE FROM public.customers
  WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_customers_deleted = ROW_COUNT;

  -- Storefront customers should not have audit_logs or notification entries,
  -- but handle defensively to prevent FK violations during auth.users deletion.
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DELETE FROM public.audit_logs WHERE user_id = v_user_id;
  END IF;

  -- Remove login access.
  DELETE FROM auth.users
  WHERE id = v_user_id;
  GET DIAGNOSTICS v_auth_users_deleted = ROW_COUNT;

  IF v_auth_users_deleted <> 1 THEN
    RAISE EXCEPTION 'Failed to delete account';
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted', jsonb_build_object(
      'push_tokens', v_push_tokens_deleted,
      'wish_list_items', v_wishlist_deleted,
      'customers', v_customers_deleted,
      'customer_loyalty_referrals_detached', v_referrals_detached,
      'auth_users', v_auth_users_deleted
    ),
    'retained', jsonb_build_object(
      'orders', 'retained_for_legal_and_compliance'
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_current_storefront_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_current_storefront_account() TO authenticated;
