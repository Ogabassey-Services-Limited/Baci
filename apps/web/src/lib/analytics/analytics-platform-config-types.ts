export interface AnalyticsPlatformConfig {
  offline_conversions_enabled: boolean | null;
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  google_analytics_id: string | null;
  ga4_api_secret: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
}

export type AnalyticsPlatformConfigRow = Partial<AnalyticsPlatformConfig>;
