-- Jumia Marketplace Integration Schema
-- Creates tables for marketplace credentials, product mappings, and order caching
-- 2026 Best Practices: RLS, proper indexes, encrypted token storage

-- =============================================================================
-- 1. MARKETPLACE INTEGRATIONS (stores OAuth credentials)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('jumia', 'konga', 'jiji')),
  shop_id TEXT, -- External platform shop ID
  shop_name TEXT,
  country_code TEXT CHECK (country_code IN ('NG', 'KE', 'EG', 'MA', 'GH', 'CI', 'SN', 'UG', 'TZ', 'ZA')),
  
  -- OAuth tokens (should be encrypted at rest via Supabase Vault in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_config JSONB DEFAULT '{"products": true, "orders": true, "stock": true}'::jsonb NOT NULL,
  sync_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Unique constraint: one shop per platform per merchant
  UNIQUE(merchant_id, platform, shop_id)
);

-- Index for quick lookup by merchant
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_merchant 
  ON public.marketplace_integrations(merchant_id);

-- Index for active integrations (used by cron jobs)
CREATE INDEX IF NOT EXISTS idx_marketplace_integrations_active 
  ON public.marketplace_integrations(platform, is_active) 
  WHERE is_active = true;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_marketplace_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_marketplace_integrations_updated_at ON public.marketplace_integrations;
CREATE TRIGGER trigger_marketplace_integrations_updated_at
  BEFORE UPDATE ON public.marketplace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_integrations_updated_at();

-- =============================================================================
-- 2. JUMIA PRODUCT MAPPINGS (links Baci products to Jumia SKUs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.jumia_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  
  -- Jumia identifiers
  jumia_sku TEXT NOT NULL,
  jumia_seller_sku TEXT,
  jumia_product_id TEXT,
  jumia_shop_id TEXT NOT NULL,
  
  -- Sync status
  sync_status TEXT DEFAULT 'pending' NOT NULL CHECK (sync_status IN ('pending', 'synced', 'error', 'paused')),
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  
  -- Feed tracking (for async processing)
  last_feed_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Unique constraint: one mapping per product/variant per shop
  UNIQUE(product_id, variant_id, jumia_shop_id)
);

-- Index for fetching by merchant
CREATE INDEX IF NOT EXISTS idx_jumia_product_mappings_merchant 
  ON public.jumia_product_mappings(merchant_id);

-- Index for syncing products
CREATE INDEX IF NOT EXISTS idx_jumia_product_mappings_sync 
  ON public.jumia_product_mappings(jumia_shop_id, sync_status);

-- =============================================================================
-- 3. JUMIA ORDERS (caches Jumia orders for unified management)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.jumia_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  
  -- Jumia order identifiers
  jumia_order_id TEXT NOT NULL UNIQUE,
  jumia_order_number TEXT,
  jumia_shop_id TEXT NOT NULL,
  
  -- Order details
  status TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Financials
  total_amount DECIMAL(12,2),
  currency TEXT DEFAULT 'NGN' NOT NULL,
  
  -- Timestamps
  created_at_jumia TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Baci integration
  baci_order_id UUID REFERENCES public.orders(id),
  
  -- Push notification tracking
  notification_sent BOOLEAN DEFAULT false NOT NULL
);

-- Index for merchant lookup
CREATE INDEX IF NOT EXISTS idx_jumia_orders_merchant 
  ON public.jumia_orders(merchant_id);

-- Index for notification jobs (find orders needing notification)
CREATE INDEX IF NOT EXISTS idx_jumia_orders_notification 
  ON public.jumia_orders(notification_sent, merchant_id) 
  WHERE notification_sent = false;

-- Index for order lookup by Jumia ID
CREATE INDEX IF NOT EXISTS idx_jumia_orders_jumia_id 
  ON public.jumia_orders(jumia_order_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_jumia_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_jumia_orders_updated_at ON public.jumia_orders;
CREATE TRIGGER trigger_jumia_orders_updated_at
  BEFORE UPDATE ON public.jumia_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_jumia_orders_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.marketplace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jumia_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jumia_orders ENABLE ROW LEVEL SECURITY;

-- Marketplace Integrations: Merchants can only access their own integrations
CREATE POLICY marketplace_integrations_merchant_policy ON public.marketplace_integrations
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
      UNION
      SELECT merchant_id FROM public.staff_members WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

-- Jumia Product Mappings: Merchants can manage their own product mappings
CREATE POLICY jumia_product_mappings_merchant_policy ON public.jumia_product_mappings
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
      UNION
      SELECT merchant_id FROM public.staff_members WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

-- Jumia Orders: Merchants can view/update their own Jumia orders
CREATE POLICY jumia_orders_merchant_policy ON public.jumia_orders
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
      UNION
      SELECT merchant_id FROM public.staff_members WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

-- Service role access (for cron jobs)
CREATE POLICY marketplace_integrations_service_policy ON public.marketplace_integrations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY jumia_product_mappings_service_policy ON public.jumia_product_mappings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY jumia_orders_service_policy ON public.jumia_orders
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.marketplace_integrations IS 'Stores OAuth credentials and settings for marketplace integrations (Jumia, Konga, etc.)';
COMMENT ON TABLE public.jumia_product_mappings IS 'Maps Baci products to Jumia catalog SKUs for sync';
COMMENT ON TABLE public.jumia_orders IS 'Caches Jumia orders for unified order management in Baci dashboard';
