import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  ensurePaidOrderInventoryConfirmed,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { fileInventoryConfirmationFailureReview } from '@/lib/payments/file-inventory-confirmation-review';
import { buildInventoryConfirmationFailurePayload } from '@/lib/payments/inventory-confirmation-response';

export type InventoryConfirmationOutcome =
  | { kind: 'confirmed' }
  | {
      kind: 'inventory_failed';
      payload: { code?: string; error?: string };
      status: number;
    }
  | { kind: 'inventory_cleanup_failed' };

// Serialized-inventory confirmation for a freshly paid order, with the
// rollback-to-previous-state compensation (only when THIS call transitioned
// the order) and the double-failure review filing.
export async function confirmPaidOrderInventoryOrRollback({
  gateway,
  orderId,
  orderWasUpdatedByThisCall,
  previousPaymentStatus,
  previousShippingStatus,
  reference,
  supabase,
  transactionGatewayReference,
  transactionId,
  merchantId,
}: {
  gateway: string;
  orderId: string;
  orderWasUpdatedByThisCall: boolean;
  previousPaymentStatus: string | null | undefined;
  previousShippingStatus: string | null | undefined;
  reference: string;
  supabase: SupabaseClient;
  transactionGatewayReference: string | null;
  transactionId: string;
  merchantId: string;
}): Promise<InventoryConfirmationOutcome> {
  try {
    await ensurePaidOrderInventoryConfirmed(supabase, merchantId, orderId);
    return { kind: 'confirmed' };
  } catch (inventoryError) {
    logger.error({
      error: inventoryError,
      message: 'Failed to confirm inventory for paid order',
      orderId,
    });

    if (orderWasUpdatedByThisCall) {
      try {
        await rollbackOrderStatusAfterInventoryConfirmationFailure(
          supabase,
          merchantId,
          orderId,
          {
            payment_status: previousPaymentStatus ?? 'pending',
            shipping_status: previousShippingStatus ?? 'pending',
          }
        );
      } catch (rollbackError) {
        await fileInventoryConfirmationFailureReview({
          gatewayReference: transactionGatewayReference ?? reference,
          merchantId,
          metadata: {
            gateway,
            inventoryError:
              inventoryError instanceof Error
                ? inventoryError.message
                : inventoryError,
            rollbackError:
              rollbackError instanceof Error
                ? rollbackError.message
                : rollbackError,
            source: 'gateway_payment_finalizer_inventory_rollback',
          },
          orderId,
          reason:
            'Gateway payment reached paid state, but serialized inventory confirmation and status rollback both failed.',
          transactionId,
        });
        return { kind: 'inventory_cleanup_failed' };
      }
    }

    const payload = buildInventoryConfirmationFailurePayload(inventoryError);
    return {
      kind: 'inventory_failed',
      payload,
      status: payload.code === 'serialized_inventory_unavailable' ? 409 : 500,
    };
  }
}
