import { describe, expect, it } from 'vitest';
import { getAdPlatformEventMappings } from './ad-platform-event-mappings';

describe('getAdPlatformEventMappings', () => {
  it('returns provider-specific names for a conversion type', () => {
    expect(getAdPlatformEventMappings('purchase')).toEqual({
      facebook: 'Purchase',
      snapchat: 'PURCHASE',
      tiktok: 'Purchase',
    });
    expect(getAdPlatformEventMappings('place_order')).toEqual({
      facebook: undefined,
      snapchat: undefined,
      tiktok: 'PlaceAnOrder',
    });
  });

  it('returns undefined mappings for an unsupported event', () => {
    const eventType = 'unsupported_event';

    const result = getAdPlatformEventMappings(eventType);

    expect(result).toEqual({
      facebook: undefined,
      snapchat: undefined,
      tiktok: undefined,
    });
  });
});
