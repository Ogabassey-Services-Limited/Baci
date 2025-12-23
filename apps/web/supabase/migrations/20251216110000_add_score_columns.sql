-- Add missing score columns and has_ois to product_key_specs
-- These are needed for filtering and the Score Calculator agent

ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS camera_score INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS battery_score INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS gaming_score INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS recommended_for TEXT[];
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_ois BOOLEAN DEFAULT false;

-- Indexes for fast filtering on scores
CREATE INDEX IF NOT EXISTS idx_pks_camera_score ON product_key_specs(camera_score);
CREATE INDEX IF NOT EXISTS idx_pks_battery_score ON product_key_specs(battery_score);
CREATE INDEX IF NOT EXISTS idx_pks_gaming_score ON product_key_specs(gaming_score);

-- Comments
COMMENT ON COLUMN product_key_specs.camera_score IS 'Composite score (0-100) based on MP, aperture, OIS, zoom capabilities';
COMMENT ON COLUMN product_key_specs.battery_score IS 'Composite score (0-100) based on mAh, charging speed, wireless charging';
COMMENT ON COLUMN product_key_specs.gaming_score IS 'Composite score (0-100) based on chipset, refresh rate, RAM, brightness';
COMMENT ON COLUMN product_key_specs.recommended_for IS 'Array of use-case tags: photographers, gamers, heavy_users, students, business, travelers';
COMMENT ON COLUMN product_key_specs.has_ois IS 'Whether the device has Optical Image Stabilization';
