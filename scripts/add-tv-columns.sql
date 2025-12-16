-- Add TV-specific columns to product_key_specs table
-- Run this in Supabase SQL Editor to enable extended TV specs

-- Panel technology
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS panel_type TEXT;
COMMENT ON COLUMN product_key_specs.panel_type IS 'Panel technology: VA, IPS, OLED';

-- Smart TV OS
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS smart_tv_os TEXT;
COMMENT ON COLUMN product_key_specs.smart_tv_os IS 'Smart TV operating system: Tizen (Samsung), webOS (LG), Google TV, etc.';

-- HDMI ports
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS hdmi_ports INTEGER;
COMMENT ON COLUMN product_key_specs.hdmi_ports IS 'Number of HDMI ports (typically 2-4)';

-- HDR support
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_hdr BOOLEAN;
COMMENT ON COLUMN product_key_specs.has_hdr IS 'HDR support (High Dynamic Range)';

-- HDR formats
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS hdr_formats TEXT;
COMMENT ON COLUMN product_key_specs.hdr_formats IS 'Supported HDR formats: HDR10, HDR10+, Dolby Vision, HLG';

-- Audio power
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS audio_power_watts INTEGER;
COMMENT ON COLUMN product_key_specs.audio_power_watts IS 'Total speaker power output in watts';

-- Bluetooth
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_bluetooth BOOLEAN;
COMMENT ON COLUMN product_key_specs.has_bluetooth IS 'Bluetooth connectivity support';

-- USB ports
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS usb_ports INTEGER;
COMMENT ON COLUMN product_key_specs.usb_ports IS 'Number of USB ports (typically 1-3)';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'product_key_specs'
AND column_name IN (
  'panel_type',
  'smart_tv_os',
  'hdmi_ports',
  'has_hdr',
  'hdr_formats',
  'audio_power_watts',
  'has_bluetooth',
  'usb_ports'
)
ORDER BY column_name;
