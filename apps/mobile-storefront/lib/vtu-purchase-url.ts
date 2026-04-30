import { EXPO_PUBLIC_API_URL } from '@/env';

export function buildVtuPurchaseUrl() {
  const baseUrl = (EXPO_PUBLIC_API_URL ?? '').trim();
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is required for VTU purchases.');
  }

  try {
    new URL(baseUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid URL.');
  }

  return `${baseUrl.replace(/\/+$/, '')}/api/vtu/purchase`;
}
