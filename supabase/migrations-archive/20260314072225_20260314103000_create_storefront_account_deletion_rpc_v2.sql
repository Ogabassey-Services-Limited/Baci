-- Apple App Store Guideline 5.1.1(v)
-- Allow signed-in storefront customers to permanently delete their account in-app.

ALTER TABLE public.customer_loyalty
DROP CONSTRAINT IF EXISTS customer_loyalty_referred_by_customer_id_fkey;

ALTER TABLE public.customer_loyalty
ADD CONSTRAINT customer_loyalty_referred_by_customer_id_fkey
FOREIGN KEY (referred_by_customer_id)
REFERENCES public.customers(id)
ON DELETE SET NULL;

-- DROP FUNCTION first because we are changing the return type from jsonb to void
DROP FUNCTION IF EXISTS public.delete_current_storefront_account();

CREATE OR REPLACE FUNCTION public.delete_current_storefront_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Account email not found';
  END IF;

  IF to_regclass('public.push_tokens') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'push_tokens'
        AND column_name = 'app_type'
    ) THEN
      EXECUTE $delete_push_tokens$
        DELETE FROM public.push_tokens
        WHERE user_id = $1
          AND (app_type = 'storefront' OR app_type IS NULL)
      $delete_push_tokens$
      USING v_user_id;
    ELSE
      EXECUTE $delete_push_tokens_legacy$
        DELETE FROM public.push_tokens
        WHERE user_id = $1
      $delete_push_tokens_legacy$
      USING v_user_id;
    END IF;
  END IF;

  IF to_regclass('public.wish_list_items') IS NOT NULL THEN
    EXECUTE $delete_wishlist$
      DELETE FROM public.wish_list_items
      WHERE lower(customer_email) = $1
    $delete_wishlist$
    USING v_email;
  END IF;

  IF to_regclass('public.product_reviews') IS NOT NULL THEN
    EXECUTE $delete_reviews$
      DELETE FROM public.product_reviews
      WHERE lower(customer_email) = $1
    $delete_reviews$
    USING v_email;
  END IF;

  IF to_regclass('public.review_helpful_votes') IS NOT NULL THEN
    EXECUTE $delete_review_votes$
      DELETE FROM public.review_helpful_votes
      WHERE lower(voter_identifier) = $1
    $delete_review_votes$
    USING v_email;
  END IF;

  DELETE FROM public.customers
  WHERE user_id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_current_storefront_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_current_storefront_account() TO authenticated;
;
