CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true)
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.merchants (
  id uuid PRIMARY KEY,
  user_id uuid,
  email text,
  business_name text,
  slug text,
  is_published boolean DEFAULT false,
  site_title text, site_tagline text, site_description text,
  business_type text, logo_url text, phone text, support_email text,
  support_phone text, social_media jsonb, brand_colors jsonb,
  business_address jsonb, legal_entity_name text, registered_address jsonb,
  tax_identification_number text, trust_profile jsonb, payout_currency text,
  template_id text, plan_expires_at timestamptz, plan_tier text,
  premium_features jsonb, country text, hero_slides jsonb,
  mobile_hero_slides jsonb, favicon_svg_url text, favicon_png_32_url text,
  favicon_png_192_url text, favicon_apple_touch_url text,
  vat_registration_status text, vat_rate numeric, feature_settings jsonb,
  published_config jsonb, pages jsonb, about_page jsonb, faq_items jsonb,
  gmc_variants_enabled boolean DEFAULT false,
  paystack_subaccount_code text,
  is_platform_admin boolean DEFAULT false
);
CREATE TABLE public.merchant_slug_aliases (
  old_slug text PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE
);
CREATE TABLE public.domains (
  id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  domain_type text, status text, verified_at timestamptz, is_primary boolean
);
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id uuid NOT NULL,
  name text, slug text, description text, image_url text, parent_id uuid,
  display_order integer, is_active boolean, buying_guide_url text,
  seo_heading text, seo_description text, seo_features jsonb, seo_faq jsonb,
  metadata jsonb
);
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text, slug text,
  description text, price numeric, compare_at_price numeric, images jsonb,
  color_images jsonb, image_hint text, status text, category text,
  category_id uuid, meta_title text, meta_description text, keywords text[],
  canonical_url text, schema_markup jsonb, faqs jsonb, specifications jsonb,
  offers jsonb, available_conditions text[], condition text,
  has_condition_offers boolean, has_variants boolean, brand text, color text,
  parent_product_id uuid, default_variant_id uuid, manage_stock boolean,
  inventory_tracking_policy text, stock integer, stock_quantity integer,
  updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(),
  condition_detail text, brand_id uuid, gtin text, mpn text,
  google_product_category text, sku text, low_stock_threshold integer,
  variant_attributes jsonb, variant_model text, min_variant_price numeric,
  max_variant_price numeric, dimensions jsonb, weight_value numeric,
  weight_unit text, metadata jsonb, fulfillment_details jsonb,
  fulfillment_fields jsonb, average_rating numeric, review_count integer,
  is_parent boolean, inventory_anchor_variant_id uuid, taxable boolean,
  tax_exempt boolean, tax_code text, vat_rate numeric,
  vat_category_code text, commodity_code text, unit_code text
);
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  stock_quantity integer, attributes jsonb, condition text, images jsonb,
  primary_image text, price_override numeric, variant_key text,
  inventory_tracking_policy text, is_inventory_anchor boolean DEFAULT false
);
CREATE TABLE public.product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  condition text NOT NULL,
  price numeric NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  status text DEFAULT 'active'
);
CREATE TABLE public.product_key_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  chipset text,
  ram_gb integer,
  storage_gb integer
);
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (product_id, category_id)
);
CREATE TABLE public.merchant_feature_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL UNIQUE REFERENCES public.merchants(id)
    ON DELETE CASCADE,
  wishlist_enabled boolean DEFAULT true,
  paystack_enabled boolean DEFAULT true,
  custom_settings jsonb DEFAULT '{}'::jsonb,
  facebook_capi_token text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.products
  ADD CONSTRAINT products_brand_id_fkey
    FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD CONSTRAINT products_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD CONSTRAINT products_default_variant_id_fkey
    FOREIGN KEY (default_variant_id) REFERENCES public.product_variants(id)
      ON DELETE SET NULL,
  ADD CONSTRAINT products_parent_product_id_fkey
    FOREIGN KEY (parent_product_id) REFERENCES public.products(id);
ALTER TABLE public.categories
  ADD CONSTRAINT categories_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON public.merchants, public.products, public.categories
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories
  TO authenticated;

-- Legacy malformed edge used to prove the corrective migration cleans it up.
INSERT INTO public.merchants (id, user_id, email, business_name, slug) VALUES
  ('a1000000-0000-4000-8000-000000000001', gen_random_uuid(),
    'legacy-one@example.com', 'Legacy One', 'legacy-one'),
  ('a1000000-0000-4000-8000-000000000002', gen_random_uuid(),
    'legacy-two@example.com', 'Legacy Two', 'legacy-two');
INSERT INTO public.products (id, merchant_id, name, slug, status) VALUES
  ('a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', 'Legacy product',
    'legacy-product', 'active');
INSERT INTO public.categories (id, merchant_id, name, slug, is_active) VALUES
  ('a3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002', 'Legacy category',
    'legacy-category', true);
INSERT INTO public.product_categories (id, product_id, category_id) VALUES
  ('a4000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001');
