import { describe, expect, it } from 'vitest';
import { mapBumpaOrderSource } from '@/lib/imports/bumpa/map-bumpa-order-source';

describe('mapBumpaOrderSource', () => {
  it('maps supported social origins to native Baci sources', () => {
    expect(mapBumpaOrderSource('instagram', 'MOBILE')).toBe('instagram');
    expect(mapBumpaOrderSource('whatsapp', 'MOBILE')).toBe('whatsapp');
    expect(mapBumpaOrderSource('facebook', 'MOBILE')).toBe('facebook');
    expect(mapBumpaOrderSource('tiktok', 'MOBILE')).toBe('tiktok');
  });

  it('maps walk-in style origins to physical sales', () => {
    expect(mapBumpaOrderSource('walk-in', 'MOBILE')).toBe('physical');
    expect(mapBumpaOrderSource('In Store', 'MOBILE')).toBe('physical');
  });

  it('maps checkout-style origins to the website source', () => {
    expect(mapBumpaOrderSource('paystack', 'MOBILE')).toBe('online_store');
    expect(mapBumpaOrderSource('others', 'MOBILE')).toBe('online_store');
  });

  it('falls back to the source channel when origin is empty', () => {
    expect(mapBumpaOrderSource(null, 'MOBILE')).toBe('online_store');
    expect(mapBumpaOrderSource(undefined, 'web')).toBe('online_store');
  });

  it('preserves unknown origins as normalized custom sources', () => {
    expect(mapBumpaOrderSource('Twitter', 'MOBILE')).toBe('twitter');
    expect(mapBumpaOrderSource('Snap Chat', 'MOBILE')).toBe('snap_chat');
  });
});
