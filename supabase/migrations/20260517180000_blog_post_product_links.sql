CREATE TABLE IF NOT EXISTS public.blog_post_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  blog_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'primary',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blog_post_products_relationship_check
    CHECK (
      relationship IN (
        'primary',
        'comparison',
        'alternative',
        'accessory',
        'support'
      )
    ),
  CONSTRAINT blog_post_products_unique
    UNIQUE (blog_post_id, product_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_products_product_id
  ON public.blog_post_products (product_id);

CREATE INDEX IF NOT EXISTS idx_blog_post_products_merchant_product
  ON public.blog_post_products (merchant_id, product_id);

ALTER TABLE public.blog_post_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published blog product links"
  ON public.blog_post_products;

CREATE POLICY "Public can read published blog product links"
  ON public.blog_post_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_posts
      WHERE blog_posts.id = blog_post_products.blog_post_id
        AND blog_posts.merchant_id = blog_post_products.merchant_id
        AND blog_posts.status = 'published'
        AND blog_posts.published_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Merchant staff can manage blog product links"
  ON public.blog_post_products;

CREATE POLICY "Merchant staff can manage blog product links"
  ON public.blog_post_products
  FOR ALL
  TO authenticated
  USING (public.has_merchant_access(merchant_id))
  WITH CHECK (
    public.has_merchant_access(merchant_id)
    AND EXISTS (
      SELECT 1
      FROM public.blog_posts
      WHERE blog_posts.id = blog_post_products.blog_post_id
        AND blog_posts.merchant_id = blog_post_products.merchant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.products
      WHERE products.id = blog_post_products.product_id
        AND products.merchant_id = blog_post_products.merchant_id
    )
  );

GRANT SELECT ON public.blog_post_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_post_products TO authenticated;
GRANT ALL ON public.blog_post_products TO service_role;
