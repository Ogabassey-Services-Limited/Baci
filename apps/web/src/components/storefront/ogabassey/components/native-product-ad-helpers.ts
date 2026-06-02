import type { Product } from '../types';

/**
 * Native ad data structure returned by GAM.
 * These fields match the custom native format in GAM.
 */
export interface NativeAdData {
  headline: string;
  image: string;
  body?: string;
  price?: string;
  cta?: string;
  clickUrl: string;
  advertiserName?: string;
  advertiserLogo?: string;
  starRating?: number;
}

interface NativeAdFieldReader {
  get: (field: string) => unknown;
}

export interface NativeAdLoadEvent {
  slot: googletag.Slot;
  nativeAd: NativeAdFieldReader;
}

export interface NativeSlotRenderEvent {
  slot: googletag.Slot;
  isEmpty?: boolean;
}

type NativePubAdsServiceWithOptionalRemove = googletag.PubAdsService & {
  removeEventListener?: (
    eventType: 'slotNativeAdLoad' | 'slotRenderEnded',
    listener: (event: unknown) => void
  ) => void;
};

export function registerNativePubAdsListener(
  pubads: googletag.PubAdsService,
  eventType: 'slotNativeAdLoad' | 'slotRenderEnded',
  listener: (event: unknown) => void
) {
  pubads.addEventListener(eventType, listener);

  return () => {
    const removablePubads = pubads as NativePubAdsServiceWithOptionalRemove;
    removablePubads.removeEventListener?.(eventType, listener);
  };
}

export function readNativeAdString(
  nativeAd: NativeAdFieldReader,
  field: string
) {
  const value = nativeAd.get(field);
  return typeof value === 'string' ? value : undefined;
}

export function readNativeAdImageUrl(
  nativeAd: NativeAdFieldReader,
  field: string
) {
  const value = nativeAd.get(field);
  if (typeof value !== 'object' || value === null || !('url' in value)) {
    return undefined;
  }

  const { url } = value as { url?: unknown };
  return typeof url === 'string' ? url : undefined;
}

export function readNativeAdRating(nativeAd: NativeAdFieldReader) {
  const value = nativeAd.get('rating');
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function nativeAdToProduct(ad: NativeAdData, index: number): Product {
  const priceMatch = ad.price?.match(/[\d,]+/);
  const rawPrice = priceMatch
    ? Number.parseInt(priceMatch[0].replace(/,/g, ''), 10)
    : 0;

  return {
    id: `native-ad-${index}-${Date.now()}`,
    slug: undefined,
    name: ad.headline,
    price: ad.price || 'Sponsored',
    rawPrice,
    image: ad.image,
    description: ad.body || '',
    rating: ad.starRating || 4.5,
    condition: 'New' as const,
    brand: ad.advertiserName,
    _isSponsored: true,
    _clickUrl: ad.clickUrl,
  } as Product & { _isSponsored: boolean; _clickUrl: string };
}
