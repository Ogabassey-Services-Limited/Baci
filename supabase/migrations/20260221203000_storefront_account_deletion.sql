-- Storefront account deletion RPC for Apple 5.1.1(v) compliance.
-- Deletes auth access and storefront-linked profile data while retaining orders.

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

  -- Remove storefront customer profile rows linked to this auth user.
  -- Orders are retained (orders.customer_id is nullable and can be set to NULL).
  DELETE FROM public.customers
  WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_customers_deleted = ROW_COUNT;

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
