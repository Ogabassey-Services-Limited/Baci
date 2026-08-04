-- Allow the server-signed agentic catalog client to resolve only active,
-- same-merchant category memberships for its own active products.
CREATE POLICY product_categories_agentic_catalog_read
  ON public.product_categories
  FOR SELECT
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND EXISTS (
      SELECT 1
      FROM public.products AS product
      JOIN public.categories AS category
        ON category.id = product_categories.category_id
        AND product.merchant_id = category.merchant_id
      WHERE product.id = product_categories.product_id
        AND product.merchant_id = public.current_agentic_merchant_id()
        AND product.status = 'active'
        AND category.is_active IS TRUE
    )
  );
