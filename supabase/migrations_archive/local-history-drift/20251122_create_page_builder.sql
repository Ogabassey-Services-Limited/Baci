-- Create page_configs table
CREATE TABLE IF NOT EXISTS page_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL, -- 'home', 'about', 'contact', or custom slug
  page_name TEXT NOT NULL, -- Display name
  draft_config JSONB, -- Current work in progress
  published_config JSONB, -- Live version
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  
  UNIQUE(merchant_id, page_slug)
);

-- Create page_config_history table for rollbacks
CREATE TABLE IF NOT EXISTS page_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_config_id UUID NOT NULL REFERENCES page_configs(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  version_note TEXT -- e.g. "Published on 2024-01-01"
);

-- Indexes
CREATE INDEX idx_page_configs_merchant ON page_configs(merchant_id);
CREATE INDEX idx_page_config_history_config ON page_config_history(page_config_id);

-- RLS Policies
ALTER TABLE page_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_config_history ENABLE ROW LEVEL SECURITY;

-- Policies for page_configs
CREATE POLICY "Merchants can view their own page configs" 
  ON page_configs FOR SELECT 
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own page configs" 
  ON page_configs FOR INSERT 
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own page configs" 
  ON page_configs FOR UPDATE 
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their own page configs" 
  ON page_configs FOR DELETE 
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Policies for page_config_history
CREATE POLICY "Merchants can view their own page history" 
  ON page_config_history FOR SELECT 
  USING (page_config_id IN (
    SELECT id FROM page_configs WHERE merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  ));

-- Public read access for published configs (for storefronts)
CREATE POLICY "Public can view published configs" 
  ON page_configs FOR SELECT 
  USING (true);
