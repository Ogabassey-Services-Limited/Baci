import Constants from 'expo-constants';
import { resolveApiBaseUrl } from '@/lib/api-url';

export const TRACK_ORDER_API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
);

export const TRACK_ORDER_MERCHANT_SLUG =
  Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';
