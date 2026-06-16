import { describe, expect, it } from 'vitest';
import { SerializedInventoryUnavailableError } from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { buildInventoryConfirmationFailurePayload } from './inventory-confirmation-response';

describe('buildInventoryConfirmationFailurePayload', () => {
  it('maps serialized inventory availability failures to the public retry code', () => {
    expect(
      buildInventoryConfirmationFailurePayload(
        new SerializedInventoryUnavailableError()
      )
    ).toEqual({
      code: 'serialized_inventory_unavailable',
      error: 'serialized_inventory_unavailable',
    });
  });

  it('hides generic inventory failure internals behind a stable response', () => {
    expect(
      buildInventoryConfirmationFailurePayload(new Error('db down'))
    ).toEqual({
      code: 'INVENTORY_CONFIRMATION_FAILED',
      error: 'Inventory confirmation failed',
    });
  });
});
