CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true)
$$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.merchants (
  id uuid PRIMARY KEY,
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
  published_config jsonb, pages jsonb, about_page jsonb, faq_items jsonb
);
CREATE TABLE public.domains (
  id uuid PRIMARY KEY, merchant_id uuid NOT NULL, domain text NOT NULL,
  domain_type text, status text, verified_at timestamptz, is_primary boolean
);
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id uuid NOT NULL,
  name text, slug text, description text, image_url text, parent_id uuid,
  display_order integer, is_active boolean, buying_guide_url text,
  seo_heading text, seo_description text, seo_features jsonb, seo_faq jsonb,
  metadata jsonb
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY, merchant_id uuid NOT NULL, name text, slug text,
  description text, price numeric, compare_at_price numeric, images jsonb,
  color_images jsonb, image_hint text, status text, category text,
  category_id uuid, meta_title text, meta_description text, keywords text[],
  canonical_url text, schema_markup jsonb, faqs jsonb, specifications jsonb,
  offers jsonb, available_conditions text[], condition text,
  has_condition_offers boolean, has_variants boolean, brand text, color text,
  parent_product_id uuid, default_variant_id uuid, manage_stock boolean,
  inventory_tracking_policy text, stock integer, stock_quantity integer
);
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY, merchant_id uuid, product_id uuid NOT NULL, sku text,
  stock_quantity integer, attributes jsonb, condition text, images jsonb,
  primary_image text, price_override numeric, variant_key text,
  inventory_tracking_policy text
);
