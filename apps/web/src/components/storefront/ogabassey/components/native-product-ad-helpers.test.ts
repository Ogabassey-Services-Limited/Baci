import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  nativeAdToProduct,
  readNativeAdImageUrl,
  readNativeAdRating,
  readNativeAdString,
  registerNativePubAdsListener,
  type NativeAdData,
} from './native-product-ad-helpers';

type NativeAdEventType = 'slotNativeAdLoad' | 'slotRenderEnded';
type NativeAdListener = (event: unknown) => void;

function createNativeAd(fields: Record<string, unknown>) {
  return {
    get: (field: string) => fields[field],
  };
}

function createPubAdsService(options: { withRemove: boolean }) {
  const addEventListener = vi.fn<
    (eventType: NativeAdEventType, listener: NativeAdListener) => void
  >();
  const removeEventListener = options.withRemove
    ? vi.fn<
        (eventType: NativeAdEventType, listener: NativeAdListener) => void
      >()
    : undefined;

  return {
    pubads: {
      addEventListener,
      ...(removeEventListener ? { removeEventListener } : {}),
    } as unknown as googletag.PubAdsService,
    addEventListener,
    removeEventListener,
  };
}

describe('native ad GPT listeners', () => {
  it('registers and removes native ad listeners with the original callback', () => {
    const { pubads, addEventListener, removeEventListener } =
      createPubAdsService({ withRemove: true });
    const listener = vi.fn();

    const cleanup = registerNativePubAdsListener(
      pubads,
      'slotNativeAdLoad',
      listener
    );

    expect(addEventListener).toHaveBeenCalledWith(
      'slotNativeAdLoad',
      listener
    );

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith(
      'slotNativeAdLoad',
      listener
    );
  });

  it('does not throw when cleanup runs against older GPT services', () => {
    const { pubads, addEventListener } = createPubAdsService({
      withRemove: false,
    });
    const listener = vi.fn();

    const cleanup = registerNativePubAdsListener(
      pubads,
      'slotRenderEnded',
      listener
    );

    expect(addEventListener).toHaveBeenCalledWith('slotRenderEnded', listener);
    expect(cleanup).not.toThrow();
  });
});

describe('native ad field readers', () => {
  it('reads only string fields from GAM native ad data', () => {
    const nativeAd = createNativeAd({
      headline: 'Sponsored phone',
      price: 500000,
    });

    expect(readNativeAdString(nativeAd, 'headline')).toBe('Sponsored phone');
    expect(readNativeAdString(nativeAd, 'price')).toBeUndefined();
    expect(readNativeAdString(nativeAd, 'missing')).toBeUndefined();
  });

  it('reads image URLs from native ad image objects only', () => {
    const nativeAd = createNativeAd({
      image: { url: 'https://cdn.example.com/ad.jpg' },
      icon: { url: 42 },
      cta: 'not-an-image',
    });

    expect(readNativeAdImageUrl(nativeAd, 'image')).toBe(
      'https://cdn.example.com/ad.jpg'
    );
    expect(readNativeAdImageUrl(nativeAd, 'icon')).toBeUndefined();
    expect(readNativeAdImageUrl(nativeAd, 'cta')).toBeUndefined();
    expect(readNativeAdImageUrl(nativeAd, 'missing')).toBeUndefined();
  });

  it('normalizes numeric and string ratings without accepting invalid values', () => {
    expect(readNativeAdRating(createNativeAd({ rating: 4.25 }))).toBe(4.25);
    expect(readNativeAdRating(createNativeAd({ rating: '4.75' }))).toBe(4.75);
    expect(
      readNativeAdRating(createNativeAd({ rating: 'unrated' }))
    ).toBeUndefined();
    expect(
      readNativeAdRating(createNativeAd({ rating: null }))
    ).toBeUndefined();
  });
});

describe('nativeAdToProduct', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps native ad data into sponsored product cards with parsed pricing', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const ad: NativeAdData = {
      headline: 'Featured iPhone',
      image: 'https://cdn.example.com/iphone.jpg',
      body: 'Clean UK used device',
      price: 'NGN 1,250,000',
      clickUrl: 'https://ads.example.com/click',
      advertiserName: 'Ogabassey',
      starRating: 4.8,
    };

    expect(nativeAdToProduct(ad, 2)).toMatchObject({
      _clickUrl: 'https://ads.example.com/click',
      _isSponsored: true,
      brand: 'Ogabassey',
      condition: 'New',
      description: 'Clean UK used device',
      id: 'native-ad-2-1700000000000',
      image: 'https://cdn.example.com/iphone.jpg',
      name: 'Featured iPhone',
      price: 'NGN 1,250,000',
      rating: 4.8,
      rawPrice: 1250000,
    });
  });

  it('falls back when optional display fields are missing', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_001);
    const ad: NativeAdData = {
      headline: 'Sponsored accessory',
      image: 'https://cdn.example.com/case.jpg',
      clickUrl: 'https://ads.example.com/accessory',
    };

    expect(nativeAdToProduct(ad, 0)).toMatchObject({
      _clickUrl: 'https://ads.example.com/accessory',
      _isSponsored: true,
      description: '',
      id: 'native-ad-0-1700000000001',
      price: 'Sponsored',
      rating: 4.5,
      rawPrice: 0,
    });
  });
});
