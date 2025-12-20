-- Product Key Specs Table - Normalized specifications for fast queries and SEO
-- This table stores the most important comparison fields in typed columns

CREATE TABLE IF NOT EXISTS product_key_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Display
  screen_size_inches DECIMAL(4,2),           -- e.g., 6.78
  display_type VARCHAR(50),                   -- e.g., AMOLED, IPS LCD
  refresh_rate_hz INTEGER,                    -- e.g., 120, 144
  resolution_width INTEGER,                   -- e.g., 1080
  resolution_height INTEGER,                  -- e.g., 2436
  peak_brightness_nits INTEGER,               -- e.g., 1300
  
  -- Performance
  chipset VARCHAR(100),                       -- e.g., MediaTek Dimensity 8350
  cpu_cores INTEGER,                          -- e.g., 8
  cpu_speed_ghz DECIMAL(3,2),                 -- Max speed, e.g., 3.35
  gpu VARCHAR(100),                           -- e.g., Mali-G615 MC6
  
  -- Memory
  ram_gb INTEGER,                             -- e.g., 8, 12
  storage_gb INTEGER,                         -- e.g., 256, 512
  storage_type VARCHAR(20),                   -- e.g., UFS 4.0, eMMC
  expandable_storage BOOLEAN DEFAULT false,
  max_expandable_tb DECIMAL(3,1),             -- e.g., 2.0
  
  -- Camera
  main_camera_mp INTEGER,                     -- e.g., 108, 50
  main_camera_aperture DECIMAL(2,1),          -- e.g., 1.7, 1.9
  ultrawide_camera_mp INTEGER,
  telephoto_camera_mp INTEGER,
  optical_zoom DECIMAL(2,1),                  -- e.g., 3.0x
  selfie_camera_mp INTEGER,                   -- e.g., 32, 13
  video_4k BOOLEAN DEFAULT false,
  ois BOOLEAN DEFAULT false,                  -- Optical Image Stabilization
  
  -- Battery
  battery_mah INTEGER,                        -- e.g., 5000, 5200
  charging_watt INTEGER,                      -- e.g., 45, 100
  wireless_charging_watt INTEGER,
  reverse_charging BOOLEAN DEFAULT false,
  
  -- Connectivity
  is_5g BOOLEAN DEFAULT false,
  nfc BOOLEAN DEFAULT false,
  wifi_version VARCHAR(20),                   -- e.g., Wi-Fi 6, Wi-Fi 5
  bluetooth_version DECIMAL(2,1),             -- e.g., 5.4
  infrared BOOLEAN DEFAULT false,
  
  -- Physical
  weight_grams INTEGER,                       -- e.g., 198
  thickness_mm DECIMAL(4,2),                  -- e.g., 7.8
  ip_rating VARCHAR(10),                      -- e.g., IP64, IP68
  
  -- OS
  android_version INTEGER,                    -- e.g., 14, 15
  custom_ui VARCHAR(50),                      -- e.g., XOS 15.1
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(product_id)
);

-- Create index for fast product lookups
CREATE INDEX IF NOT EXISTS idx_product_key_specs_product_id ON product_key_specs(product_id);

-- Create indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_product_key_specs_ram ON product_key_specs(ram_gb);
CREATE INDEX IF NOT EXISTS idx_product_key_specs_storage ON product_key_specs(storage_gb);
CREATE INDEX IF NOT EXISTS idx_product_key_specs_battery ON product_key_specs(battery_mah);
CREATE INDEX IF NOT EXISTS idx_product_key_specs_screen ON product_key_specs(screen_size_inches);
CREATE INDEX IF NOT EXISTS idx_product_key_specs_5g ON product_key_specs(is_5g);

-- Enable RLS
ALTER TABLE product_key_specs ENABLE ROW LEVEL SECURITY;

-- Public read access (specs are public info)
CREATE POLICY "product_key_specs_select_policy" ON product_key_specs
  FOR SELECT USING (true);

-- Merchants can update their own product specs
CREATE POLICY "product_key_specs_insert_policy" ON product_key_specs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p 
      WHERE p.id = product_id 
      AND p.merchant_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "product_key_specs_update_policy" ON product_key_specs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM products p 
      WHERE p.id = product_id 
      AND p.merchant_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "product_key_specs_delete_policy" ON product_key_specs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM products p 
      WHERE p.id = product_id 
      AND p.merchant_id = (SELECT auth.uid())
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_product_key_specs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_key_specs_updated_at_trigger
  BEFORE UPDATE ON product_key_specs
  FOR EACH ROW
  EXECUTE FUNCTION update_product_key_specs_updated_at();

COMMENT ON TABLE product_key_specs IS 'Normalized product specifications for fast filtering, comparison, and SEO. Auto-populated from products.specifications JSONB.';
