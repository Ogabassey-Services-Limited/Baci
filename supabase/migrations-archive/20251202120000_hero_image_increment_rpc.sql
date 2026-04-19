-- Create RPC function for atomic hero image usage increment
-- This ensures race conditions don't cause incorrect counts

CREATE OR REPLACE FUNCTION increment_hero_image_usage(image_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE ai_hero_images
    SET usage_count = COALESCE(usage_count, 0) + 1
    WHERE id = image_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_hero_image_usage(UUID) IS 'Atomically increments the usage count for a hero image';
