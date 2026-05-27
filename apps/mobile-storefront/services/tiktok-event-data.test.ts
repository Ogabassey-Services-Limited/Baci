import { toTikTokEventData } from './tiktok-event-data';

describe('toTikTokEventData', () => {
  it('handles undefined or missing params', () => {
    expect(toTikTokEventData()).toEqual([]);
    expect(toTikTokEventData(undefined)).toEqual([]);
  });

  it('serializes primitive values for the TikTok native module', () => {
    const input = {
      currency: 'NGN',
      quantity: 2,
      subscribed: true,
    };

    const result = toTikTokEventData(input);

    expect(result).toEqual([
      { key: 'currency', value: 'NGN' },
      { key: 'quantity', value: '2' },
      { key: 'subscribed', value: 'true' },
    ]);
  });

  it('serializes structured values as JSON strings', () => {
    const input = {
      contents: [{ content_id: 'sku-1', quantity: 1 }],
    };

    const result = toTikTokEventData(input);

    expect(result).toEqual([
      {
        key: 'contents',
        value: '[{"content_id":"sku-1","quantity":1}]',
      },
    ]);
  });

  it('omits null, undefined, non-finite, and unserializable values', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const input = {
      empty: null,
      missing: undefined,
      badNumber: Number.NaN,
      infinity: Number.POSITIVE_INFINITY,
      negativeInfinity: Number.NEGATIVE_INFINITY,
      circular,
      valid: 'kept',
    };

    const result = toTikTokEventData(input);

    expect(result).toEqual([{ key: 'valid', value: 'kept' }]);
  });

  it('keeps empty strings and stringifies bigint values', () => {
    const input = {
      emptyString: '',
      largeQuantity: BigInt('9007199254740993'),
    };

    const result = toTikTokEventData(input);

    expect(result).toEqual([
      { key: 'emptyString', value: '' },
      { key: 'largeQuantity', value: '9007199254740993' },
    ]);
  });
});
