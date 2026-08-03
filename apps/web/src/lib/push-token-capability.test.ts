import { describe, expect, it, vi } from 'vitest';
import { filterPushTokensByShipmentUpdateCapability } from './push-token-capability';

describe('filterPushTokensByShipmentUpdateCapability', () => {
  it('filters out tokens from builds without the requested capability', () => {
    const query = { gte: vi.fn() };
    query.gte.mockReturnValue(query);

    const result = filterPushTokensByShipmentUpdateCapability(query, 1);

    expect(result).toBe(query);
    expect(query.gte).toHaveBeenCalledWith('shipment_update_capability', 1);
  });

  it('leaves the token query unchanged when no capability is required', () => {
    const query = { gte: vi.fn() };

    filterPushTokensByShipmentUpdateCapability(query);

    expect(query.gte).not.toHaveBeenCalled();
  });
});
