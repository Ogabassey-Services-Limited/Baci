-- Schema Alignment Migration for product_key_specs
-- Aligns existing schema with Koray's briefing and seo-utils.ts expectations
-- See: /Users/mac/.claude/plans/nifty-scribbling-pebble.md

-- ============================================================================
-- STEP 1: Rename Existing Columns to match Koray's naming convention
-- ============================================================================

-- Note: Using DO block to handle cases where columns may already be renamed
DO $$
BEGIN
  -- weight_grams → weight_g
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'weight_grams') THEN
    ALTER TABLE product_key_specs RENAME COLUMN weight_grams TO weight_g;
  END IF;

  -- selfie_camera_mp → front_camera_mp
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'selfie_camera_mp') THEN
    ALTER TABLE product_key_specs RENAME COLUMN selfie_camera_mp TO front_camera_mp;
  END IF;

  -- nfc → has_nfc
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'nfc') THEN
    ALTER TABLE product_key_specs RENAME COLUMN nfc TO has_nfc;
  END IF;

  -- expandable_storage → has_card_slot
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'expandable_storage') THEN
    ALTER TABLE product_key_specs RENAME COLUMN expandable_storage TO has_card_slot;
  END IF;

  -- peak_brightness_nits → display_peak_brightness
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'peak_brightness_nits') THEN
    ALTER TABLE product_key_specs RENAME COLUMN peak_brightness_nits TO display_peak_brightness;
  END IF;

  -- reverse_charging → has_reverse_charging
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'reverse_charging') THEN
    ALTER TABLE product_key_specs RENAME COLUMN reverse_charging TO has_reverse_charging;
  END IF;

  -- infrared → has_infrared (consistency)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'infrared') THEN
    ALTER TABLE product_key_specs RENAME COLUMN infrared TO has_infrared;
  END IF;

  -- is_5g → has_5g (consistency with has_ prefix)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_key_specs' AND column_name = 'is_5g') THEN
    ALTER TABLE product_key_specs RENAME COLUMN is_5g TO has_5g;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add Missing Columns (~25 new fields)
-- ============================================================================

-- Display (additional)
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS display_ppi INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS display_protection TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS display_resolution TEXT;

-- Camera (additional)
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS rear_camera_features TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS rear_camera_video TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS front_camera_features TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS front_camera_video TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_dual_camera BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_triple_camera BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_quad_camera BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_ois BOOLEAN DEFAULT false;

-- Battery (additional)
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_wireless_charging BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS battery_removable BOOLEAN DEFAULT false;

-- Network
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS network_technology TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS sim_type TEXT;

-- Connectivity (additional)
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS wifi_bands TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS usb_type TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_usb_otg BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_fm_radio BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS positioning TEXT;

-- Body (additional)
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS dimensions_mm TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS build_materials TEXT;

-- Sound
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_stereo_speakers BOOLEAN DEFAULT false;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS has_headphone_jack BOOLEAN DEFAULT false;

-- Features
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS fingerprint_type TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS sensors TEXT;

-- Misc
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS available_colors TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS model_numbers TEXT;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS announced_date DATE;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS release_date DATE;

-- Laptop-specific
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS card_slot_type TEXT;

-- ============================================================================
-- STEP 3: Add Score Columns for Filtering & SEO
-- ============================================================================

ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS camera_score INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS battery_score INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS gaming_score INTEGER;
ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS recommended_for TEXT[];

-- Indexes for fast filtering on scores
CREATE INDEX IF NOT EXISTS idx_pks_camera_score ON product_key_specs(camera_score);
CREATE INDEX IF NOT EXISTS idx_pks_battery_score ON product_key_specs(battery_score);
CREATE INDEX IF NOT EXISTS idx_pks_gaming_score ON product_key_specs(gaming_score);

-- ============================================================================
-- STEP 4: Update Comments
-- ============================================================================

COMMENT ON TABLE product_key_specs IS 'Normalized product specifications for fast filtering, comparison, SEO schema.org markup, and scoring. Auto-populated from products.specifications JSONB and web research.';

COMMENT ON COLUMN product_key_specs.camera_score IS 'Composite score (0-100) based on MP, aperture, OIS, zoom capabilities';
COMMENT ON COLUMN product_key_specs.battery_score IS 'Composite score (0-100) based on mAh, charging speed, wireless charging';
COMMENT ON COLUMN product_key_specs.gaming_score IS 'Composite score (0-100) based on chipset, refresh rate, RAM, brightness';
COMMENT ON COLUMN product_key_specs.recommended_for IS 'Array of use-case tags: photographers, gamers, heavy_users, students, business, travelers';
