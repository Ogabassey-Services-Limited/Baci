import { isSerializedInventoryUnavailableError } from '@/lib/payments/ensure-paid-order-inventory-confirmed';

export function buildInventoryConfirmationFailurePayload(error: unknown) {
  if (isSerializedInventoryUnavailableError(error)) {
    return {
      code: 'serialized_inventory_unavailable',
      error: 'serialized_inventory_unavailable',
    };
  }

  return {
    code: 'INVENTORY_CONFIRMATION_FAILED',
    error: 'Inventory confirmation failed',
  };
}
