import { normalizeTikTokEventData } from './event-data';

describe('normalizeTikTokEventData', () => {
  it('returns null when event data is missing or empty', () => {
    expect(normalizeTikTokEventData()).toBeNull();
    expect(normalizeTikTokEventData([])).toBeNull();
  });

  it('trims keys and serializes primitive values for the native SDK', () => {
    const result = normalizeTikTokEventData([
      { key: ' value ', value: 1000 },
      { key: 'currency', value: 'NGN' },
      { key: 'in_stock', value: true },
    ]);

    expect(result).toEqual([
      { key: 'value', value: '1000' },
      { key: 'currency', value: 'NGN' },
      { key: 'in_stock', value: 'true' },
    ]);
  });

  it('drops entries with empty keys', () => {
    const result = normalizeTikTokEventData([
      { key: ' ', value: 'ignored' },
      { key: 'event_source', value: 'mobile_app' },
    ]);

    expect(result).toEqual([{ key: 'event_source', value: 'mobile_app' }]);
  });
});
