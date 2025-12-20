-- Add favicon support to merchants table
-- Enables merchants to upload custom favicons for their storefronts
-- Supports multiple formats (SVG, PNG) and sizes for broad device compatibility

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS favicon_svg_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_png_32_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_png_192_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_apple_touch_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN merchants.favicon_svg_url IS 'URL to SVG favicon (preferred for modern browsers)';
COMMENT ON COLUMN merchants.favicon_png_32_url IS 'URL to 32x32 PNG favicon (standard size, Safari fallback)';
COMMENT ON COLUMN merchants.favicon_png_192_url IS 'URL to 192x192 PNG (Android home screen, PWA)';
COMMENT ON COLUMN merchants.favicon_apple_touch_url IS 'URL to 180x180 PNG (iOS Apple Touch Icon)';
COMMENT ON COLUMN merchants.favicon_uploaded_at IS 'Timestamp of favicon upload (for cache-busting)';
