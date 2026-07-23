import { describe, expect, it } from 'vitest';
import { isConversionEvent } from './is-conversion-event';

describe('isConversionEvent', () => {
  it('recognizes canonical conversion types and rejects telemetry types', () => {
    expect(isConversionEvent('add_to_cart')).toBe(true);
    expect(isConversionEvent('place_order')).toBe(true);
    expect(isConversionEvent('page_view')).toBe(false);
  });
});
