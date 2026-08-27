import { describe, expect, it } from 'vitest';
import { countMetaAdsConversions } from './conversion-count';

describe('countMetaAdsConversions', () => {
  it('adds selected action values without Number precision loss', () => {
    expect(
      countMetaAdsConversions([
        { actionType: 'purchase', value: '9007199254740993.5' },
        { actionType: 'purchase', value: '0.25' },
        { actionType: 'link_click', value: '1000000' },
      ])
    ).toBe('9007199254740993.75');
  });

  it('returns zero when no conversion action is present', () => {
    expect(
      countMetaAdsConversions([
        { actionType: 'link_click', value: '4' },
        { actionType: 'view_content', value: '2.5' },
      ])
    ).toBe('0');
  });

  it('counts provider-specific purchase action types', () => {
    expect(
      countMetaAdsConversions([
        { actionType: 'offsite_conversion.fb_pixel_purchase', value: '2' },
        { actionType: 'omni_purchase', value: '3' },
        { actionType: 'link_click', value: '50' },
      ])
    ).toBe('5');
  });
});
