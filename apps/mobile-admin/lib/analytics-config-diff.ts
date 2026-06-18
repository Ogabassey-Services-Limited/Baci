export interface AnalyticsState {
  // Google Analytics 4
  google_analytics_id: string;
  ga4_api_secret: string;
  // Facebook/Meta
  facebook_pixel_id: string;
  facebook_capi_token: string;
  // TikTok
  tiktok_pixel_id: string;
  tiktok_access_token: string;
  // Snapchat
  snapchat_pixel_id: string;
  snapchat_capi_token: string;
  // Feature toggle
  offline_conversions_enabled: boolean;
}

// String credential fields are persisted as `value || null` (empty string ->
// NULL). The toggle is stored as a plain boolean. Listing the keys explicitly
// keeps the dirty diff exhaustive and type-checked.
const STRING_FIELDS = [
  'google_analytics_id',
  'ga4_api_secret',
  'facebook_pixel_id',
  'facebook_capi_token',
  'tiktok_pixel_id',
  'tiktok_access_token',
  'snapchat_pixel_id',
  'snapchat_capi_token',
] as const satisfies readonly (keyof AnalyticsState)[];

// Row shape sent to Supabase: string fields become `string | null`, the toggle
// stays a boolean. Partial because only changed fields are written.
export type AnalyticsUpdate = Partial<
  Record<(typeof STRING_FIELDS)[number], string | null> & {
    offline_conversions_enabled: boolean;
  }
>;

// Build a per-field dirty diff between the originally seeded snapshot and the
// current buffer, so unchanged analytics fields are NOT rewritten (drift vector
// V3: a blanket all-field update lets a stale buffer clobber values another
// surface changed). Returns only the keys the user actually edited.
export function buildAnalyticsDiff(
  current: AnalyticsState,
  baseline: AnalyticsState | null
): AnalyticsUpdate {
  const update: AnalyticsUpdate = {};

  for (const field of STRING_FIELDS) {
    const nextValue = current[field] || null;
    const prevValue = baseline ? baseline[field] || null : undefined;
    if (!baseline || nextValue !== prevValue) {
      update[field] = nextValue;
    }
  }

  if (
    !baseline ||
    current.offline_conversions_enabled !== baseline.offline_conversions_enabled
  ) {
    update.offline_conversions_enabled = current.offline_conversions_enabled;
  }

  return update;
}

export function analyticsStatesEqual(
  left: AnalyticsState | null,
  right: AnalyticsState | null
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.google_analytics_id === right.google_analytics_id &&
    left.ga4_api_secret === right.ga4_api_secret &&
    left.facebook_pixel_id === right.facebook_pixel_id &&
    left.facebook_capi_token === right.facebook_capi_token &&
    left.tiktok_pixel_id === right.tiktok_pixel_id &&
    left.tiktok_access_token === right.tiktok_access_token &&
    left.snapchat_pixel_id === right.snapchat_pixel_id &&
    left.snapchat_capi_token === right.snapchat_capi_token &&
    left.offline_conversions_enabled === right.offline_conversions_enabled
  );
}
