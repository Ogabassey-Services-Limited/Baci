-- Migration: Add store settings columns to page_configs table
-- Description: Adds draft_store_settings and published_store_settings columns to support
--              comprehensive e-commerce store configuration (product pages, cart, checkout, shipping, policies)
-- Created: 2024-11-24

-- Add draft_store_settings column (JSONB)
ALTER TABLE page_configs
ADD COLUMN IF NOT EXISTS draft_store_settings JSONB DEFAULT NULL;

-- Add published_store_settings column (JSONB)
ALTER TABLE page_configs
ADD COLUMN IF NOT EXISTS published_store_settings JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN page_configs.draft_store_settings IS
'Draft store settings including product page layout, cart configuration, checkout options, shipping settings, and store policies';

COMMENT ON COLUMN page_configs.published_store_settings IS
'Published store settings that are live on the storefront';

-- Create index for faster JSONB queries if needed
CREATE INDEX IF NOT EXISTS idx_page_configs_draft_store_settings
ON page_configs USING gin (draft_store_settings);

CREATE INDEX IF NOT EXISTS idx_page_configs_published_store_settings
ON page_configs USING gin (published_store_settings);

-- Sample store settings structure (for documentation):
/*
{
  "productPage": {
    "layout": "standard" | "wide" | "sidebar",
    "showRelatedProducts": boolean,
    "showReviews": boolean,
    "showShareButtons": boolean,
    "imageGalleryStyle": "thumbnails" | "dots" | "slider",
    "enableZoom": boolean,
    "showInventory": boolean
  },
  "cart": {
    "enableCartDrawer": boolean,
    "showShippingEstimate": boolean,
    "showProgressBar": boolean,
    "freeShippingThreshold": number,
    "enableGiftMessage": boolean,
    "enableDiscountCodes": boolean
  },
  "checkout": {
    "enableGuestCheckout": boolean,
    "requirePhoneNumber": boolean,
    "showOrderNotes": boolean,
    "showNewsletterSignup": boolean,
    "enableExpressCheckout": boolean
  },
  "shipping": {
    "showEstimatedDelivery": boolean,
    "defaultShippingMessage": string,
    "internationalShipping": boolean
  },
  "policies": {
    "returnPolicy": string,
    "shippingPolicy": string,
    "privacyPolicy": string
  }
}
*/
