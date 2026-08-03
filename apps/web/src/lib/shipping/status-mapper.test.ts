import { describe, expect, it } from 'vitest';
import { mapGiglStatus } from './status-mapper';

describe('mapGiglStatus', () => {
  it('maps documented GIGL short codes to the shared lifecycle statuses', () => {
    expect(mapGiglStatus('MAPT')).toBe('pickup_scheduled');
  });

  it('normalizes human-readable GIGL delivered statuses', () => {
    expect(mapGiglStatus('Shipment delivered')).toBe('delivered');
    expect(mapGiglStatus('Shipment delivered.')).toBe('delivered');
    expect(mapGiglStatus('shipment delivered')).toBe('delivered');
  });

  it('falls back to pending for unknown or blank statuses', () => {
    expect(mapGiglStatus('Something New')).toBe('pending');
    expect(mapGiglStatus('')).toBe('pending');
    expect(mapGiglStatus('   ')).toBe('pending');
  });

  it('normalizes human-readable statuses through screaming snake lookup', () => {
    expect(mapGiglStatus('Shipment in transit')).toBe('in_transit');
  });
});
