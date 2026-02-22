-- Add functional index for LOWER(customer_email) on wish_list_items.
-- The delete_current_storefront_account() function queries
-- WHERE LOWER(customer_email) = v_email, which requires a functional index
-- to use the B-tree rather than a sequential scan.

CREATE INDEX IF NOT EXISTS idx_wish_list_items_customer_email_lower
  ON public.wish_list_items (LOWER(customer_email));
