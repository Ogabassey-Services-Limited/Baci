/**
 * Jumia Vendor Center API — Fulfillment submodule
 * Pack (V2), ready-to-ship, cancel, print labels
 */

import type { z } from 'zod';
import type { JumiaClient } from '@/lib/jumia/client';
import type {
  JumiaCancelResponse,
  JumiaPackV2Response,
  JumiaPrintLabelsResponse,
  JumiaReadyToShipResponse,
} from '@/schemas/jumia';
import {
  JumiaCancelResponseSchema,
  JumiaPackV2ResponseSchema,
  JumiaPrintLabelsResponseSchema,
  JumiaReadyToShipResponseSchema,
} from '@/schemas/jumia';

/** Trim each ID and throw if any is blank. */
function validateAndTrimIds(ids: string[], fnName: string): string[] {
  return ids.map((id) => {
    const trimmed = id.trim();
    if (!trimmed) {
      throw new Error(`${fnName}: each orderItemId must be a non-empty string`);
    }
    return trimmed;
  });
}

// ── Pack V2 ──

/** Pack order items into shipment packages (V2 endpoint).
 * @param packages - Non-empty array of packages, each containing an orderItems string,
 *   a shipmentProviderId, and an optional trackingCode.
 * @returns The pack response from Jumia.
 * @throws If the packages array is empty or any required field is blank.
 */
export async function packOrderV2(
  client: JumiaClient,
  packages: Array<{
    orderItems: string;
    shipmentProviderId: string;
    trackingCode?: string;
  }>
): Promise<JumiaPackV2Response> {
  if (!packages.length) {
    throw new Error('packOrderV2: packages must be a non-empty array');
  }
  const trimmedPackages = packages.map((pkg, index) => {
    const orderItems = pkg.orderItems.trim();
    if (!orderItems) {
      throw new Error(
        `packOrderV2: packages[${index}].orderItems must be a non-empty string`
      );
    }
    const shipmentProviderId = pkg.shipmentProviderId.trim();
    if (!shipmentProviderId) {
      throw new Error(
        `packOrderV2: packages[${index}].shipmentProviderId must be a non-empty string`
      );
    }
    const trimmedTrackingCode = pkg.trackingCode?.trim();
    return {
      orderItems,
      shipmentProviderId,
      ...(trimmedTrackingCode && {
        trackingCode: trimmedTrackingCode,
      }),
    };
  });
  return await client.request(
    'POST',
    '/v2/orders/pack',
    JumiaPackV2ResponseSchema,
    {
      packages: trimmedPackages,
    }
  );
}

// ── Shared helper for order-item actions ──

/** Validate IDs then fire a single request with `{ orderItemIds }` body. */
async function orderItemsAction<T>(
  client: JumiaClient,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  schema: z.ZodType<T>,
  orderItemIds: string[],
  fnName: string
): Promise<T> {
  if (!orderItemIds.length) {
    throw new Error(`${fnName}: orderItemIds must be a non-empty array`);
  }
  const trimmedIds = validateAndTrimIds(orderItemIds, fnName);
  return await client.request(method, path, schema, {
    orderItemIds: trimmedIds,
  });
}

// ── Ready to Ship ──

/** Mark order items as ready for shipment.
 * @param orderItemIds - Non-empty array of order-item IDs to mark ready.
 * @throws If any ID is blank or the array is empty.
 */
export function readyToShip(
  client: JumiaClient,
  orderItemIds: string[]
): Promise<JumiaReadyToShipResponse> {
  return orderItemsAction(
    client,
    'POST',
    '/orders/ready-to-ship',
    JumiaReadyToShipResponseSchema,
    orderItemIds,
    'readyToShip'
  );
}

// ── Cancel ──

/** Cancel one or more order items.
 * @param orderItemIds - Non-empty array of order-item IDs to cancel.
 * @throws If any ID is blank or the array is empty.
 */
export function cancelItems(
  client: JumiaClient,
  orderItemIds: string[]
): Promise<JumiaCancelResponse> {
  return orderItemsAction(
    client,
    'PUT',
    '/orders/cancel',
    JumiaCancelResponseSchema,
    orderItemIds,
    'cancelItems'
  );
}

// ── Print Labels ──

/** Generate shipping labels for the given order items.
 * @param orderItemIds - Non-empty array of order-item IDs to print labels for.
 * @returns The label document(s) from Jumia.
 * @throws If any ID is blank or the array is empty.
 */
export function printLabels(
  client: JumiaClient,
  orderItemIds: string[]
): Promise<JumiaPrintLabelsResponse> {
  return orderItemsAction(
    client,
    'POST',
    '/orders/print-labels',
    JumiaPrintLabelsResponseSchema,
    orderItemIds,
    'printLabels'
  );
}
