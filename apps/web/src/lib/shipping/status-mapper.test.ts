import { describe, expect, it } from 'vitest';
import { mapGiglStatus } from './status-mapper';

describe('mapGiglStatus', () => {
  it('normalizes human-readable GIGL delivered statuses', () => {
    expect(mapGiglStatus('Shipment delivered')).toBe('delivered');
    expect(mapGiglStatus('shipment delivered')).toBe('delivered');
  });
});
