import { z } from 'zod';

export const merchantFeatureSettingsSchema = z.object({
  loyalty_enabled: z.boolean(),
  reviews_enabled: z.boolean(),
  wishlist_enabled: z.boolean(),
  order_tracking_enabled: z.boolean(),
  discount_codes_enabled: z.boolean(),
  guest_checkout_enabled: z.boolean(),
  // Payment gateways
  agentic_checkout_enabled: z.boolean(),
  paystack_enabled: z.boolean(),
  korapay_enabled: z.boolean(),
  pay_on_delivery_enabled: z.boolean(),
  credit_direct_enabled: z.boolean(),
  credit_direct_public_key: z.string().nullable(),
  credit_direct_min_amount: z.number(),
  credit_direct_max_amount: z.number(),
  preferred_local_gateway: z.enum(['paystack', 'korapay']),
  preferred_international_gateway: z.enum(['paystack', 'korapay']),
  // Shipping
  shipping_providers: z.array(z.string()),
  free_shipping_threshold: z.number().nullable(),
  shipping_markup_percentage: z.number(),
  // Checkout
  checkout_collect_phone: z.boolean(),
  checkout_require_account: z.boolean(),
  checkout_show_order_notes: z.boolean(),
  // Store pages
  about_page_enabled: z.boolean(),
  contact_page_enabled: z.boolean(),
  faq_page_enabled: z.boolean(),
  privacy_page_enabled: z.boolean(),
  terms_page_enabled: z.boolean(),
  rewards_page_enabled: z.boolean(),
  // Social proof
  show_recent_purchases: z.boolean(),
  show_stock_levels: z.boolean(),
  low_stock_threshold: z.number(),
  // Analytics
  google_analytics_id: z.string().nullable(),
  ga4_api_secret: z.string().nullable(),
  facebook_pixel_id: z.string().nullable(),
  facebook_capi_token: z.string().nullable(),
  tiktok_pixel_id: z.string().nullable(),
  tiktok_access_token: z.string().nullable(),
  snapchat_pixel_id: z.string().nullable(),
  snapchat_capi_token: z.string().nullable(),
  twitter_pixel_id: z.string().nullable(),
  // SEO
  auto_generate_schema: z.boolean(),
  custom_robots_txt: z.string().nullable(),
  // Notifications
  email_notifications_enabled: z.boolean(),
  sms_notifications_enabled: z.boolean(),
  // Blog
  blog_enabled: z.boolean(),
  auto_blog_enabled: z.boolean(),
  google_reviews_enabled: z.boolean(),
  google_place_id: z.string().nullable(),
  // VTU
  vtu_enabled: z.boolean(),
  vtu_airtime_enabled: z.boolean(),
  vtu_data_enabled: z.boolean(),
  vtu_checkout_addon_enabled: z.boolean(),
  vtu_checkout_addon_amounts: z.array(z.number()),
  vtu_loyalty_reward_enabled: z.boolean(),
  vtu_merchant_commission_rate: z.number(),
  vtu_electricity_enabled: z.boolean(),
  vtu_tv_enabled: z.boolean(),
  vtu_betting_enabled: z.boolean(),
  vtu_customer_cashback_enabled: z.boolean(),
  vtu_customer_cashback_rate: z.number(),
  // Custom
  custom_settings: z.record(z.string(), z.unknown()),
});

export type MerchantFeatureSettingsInput = z.infer<
  typeof merchantFeatureSettingsSchema
>;
