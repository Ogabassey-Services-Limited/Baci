-- Preserve malformed tenant boundaries for incident review before the following
-- migration removes them. The archive must never become a public catalog API.
CREATE TABLE IF NOT EXISTS public.product_category_cross_tenant_archive (
  membership_id uuid PRIMARY KEY,
  product_id uuid NOT NULL,
  category_id uuid NOT NULL,
  is_primary boolean,
  membership_created_at timestamptz,
  product_merchant_id uuid NOT NULL,
  category_merchant_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_category_cross_tenant_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_category_cross_tenant_archive FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_category_cross_tenant_archive
  FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO public.product_category_cross_tenant_archive (
  membership_id,
  product_id,
  category_id,
  is_primary,
  membership_created_at,
  product_merchant_id,
  category_merchant_id
)
SELECT
  membership.id,
  membership.product_id,
  membership.category_id,
  membership.is_primary,
  membership.created_at,
  product.merchant_id,
  category.merchant_id
FROM public.product_categories AS membership
JOIN public.products AS product ON product.id = membership.product_id
JOIN public.categories AS category ON category.id = membership.category_id
WHERE product.merchant_id IS DISTINCT FROM category.merchant_id
ON CONFLICT (membership_id) DO NOTHING;
