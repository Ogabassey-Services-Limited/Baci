/**
 * Jumia Vendor Center API — Consignment (Jumia Express) submodule
 * Create/update consignment orders, retrieve warehouse stock
 */

import type { JumiaClient } from '@/lib/jumia/client';
import type {
  JumiaConsignmentCreateResponse,
  JumiaConsignmentStockResponse,
} from '@/schemas/jumia';
import {
  JumiaConsignmentCreateResponseSchema,
  JumiaConsignmentStockResponseSchema,
} from '@/schemas/jumia';

/**
 * Validates a YYYY-MM-DD date string, rejecting impossible dates like Feb 31.
 * Returns the trimmed string or throws with the given field name.
 */
function validateISODate(raw: string, fieldName: string): string {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(
      `${fieldName} must be a valid ISO date string (YYYY-MM-DD)`
    );
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(
      `${fieldName} must be a valid ISO date string (YYYY-MM-DD)`
    );
  }
  return trimmed;
}

// ── Create Consignment Order ──

export async function createConsignmentOrder(
  client: JumiaClient,
  params: {
    shopId: string;
    businessClientCode: string;
    shippingDate: string;
    products: Array<{
      sku: string;
      quantity: number;
      labelCode?: string;
    }>;
    comment?: string;
  }
): Promise<JumiaConsignmentCreateResponse> {
  const shopId = params.shopId.trim();
  if (!shopId) {
    throw new Error('shopId must be a non-empty string');
  }
  const businessClientCode = params.businessClientCode.trim();
  if (!businessClientCode) {
    throw new Error('businessClientCode must be a non-empty string');
  }
  const shippingDate = validateISODate(params.shippingDate, 'shippingDate');
  if (!params.products.length) {
    throw new Error('products must be a non-empty array');
  }
  const trimmedProducts = params.products.map((product) => {
    const sku = product.sku.trim();
    if (!sku) {
      throw new Error('Each product must have a non-empty sku');
    }
    const labelCode = product.labelCode?.trim() || undefined;
    if (product.quantity <= 0 || !Number.isSafeInteger(product.quantity)) {
      throw new Error('Each product quantity must be a positive integer');
    }
    return { sku, quantity: product.quantity, ...(labelCode && { labelCode }) };
  });

  const trimmedComment = params.comment?.trim();

  return await client.request(
    'POST',
    '/consignment-order',
    JumiaConsignmentCreateResponseSchema,
    {
      shopId,
      businessClientCode,
      shippingDate,
      products: trimmedProducts,
      ...(trimmedComment && { comment: trimmedComment }),
    }
  );
}

// ── Update Consignment Order ──

export async function updateConsignmentOrder(
  client: JumiaClient,
  purchaseOrderNumber: string,
  updates: {
    isShipped?: boolean;
    trackingNumber?: string;
    actualDepartureDate?: string;
    estimatedArrivalDate?: string;
    deliveryAgentPhoneNumber?: string;
    thirdPartyLogisticsName?: string;
  }
): Promise<void> {
  const trimmedPurchaseOrderNumber = purchaseOrderNumber.trim();
  if (!trimmedPurchaseOrderNumber) {
    throw new Error('purchaseOrderNumber must be a non-empty string');
  }

  const body: Record<string, unknown> = {};
  if (updates.isShipped !== undefined) body.isShipped = updates.isShipped;
  if (updates.trackingNumber !== undefined) {
    const trimmed = updates.trackingNumber.trim();
    if (!trimmed) {
      throw new Error(
        'trackingNumber must be a non-empty string when provided'
      );
    }
    body.trackingNumber = trimmed;
  }
  if (updates.actualDepartureDate !== undefined) {
    body.actualDepartureDate = validateISODate(
      updates.actualDepartureDate,
      'actualDepartureDate'
    );
  }
  if (updates.estimatedArrivalDate !== undefined) {
    body.estimatedArrivalDate = validateISODate(
      updates.estimatedArrivalDate,
      'estimatedArrivalDate'
    );
  }
  if (updates.deliveryAgentPhoneNumber !== undefined) {
    const trimmed = updates.deliveryAgentPhoneNumber.trim();
    if (!trimmed) {
      throw new Error(
        'deliveryAgentPhoneNumber must be a non-empty string when provided'
      );
    }
    body.deliveryAgentPhoneNumber = trimmed;
  }
  if (updates.thirdPartyLogisticsName !== undefined) {
    const trimmed = updates.thirdPartyLogisticsName.trim();
    if (!trimmed) {
      throw new Error(
        'thirdPartyLogisticsName must be a non-empty string when provided'
      );
    }
    body['3plName'] = trimmed;
  }

  if (Object.keys(body).length === 0) {
    throw new Error('At least one update field must be provided');
  }

  await client.request(
    'PATCH',
    `/consignment-order/${encodeURIComponent(trimmedPurchaseOrderNumber)}`,
    undefined,
    body
  );
}

// ── Retrieve Consignment Stock ──

export async function getConsignmentStock(
  client: JumiaClient,
  businessClientCode: string,
  sku: string
): Promise<JumiaConsignmentStockResponse> {
  const trimmedBusinessClientCode = businessClientCode.trim();
  if (!trimmedBusinessClientCode) {
    throw new Error('businessClientCode must be a non-empty string');
  }
  const trimmedSku = sku.trim();
  if (!trimmedSku) {
    throw new Error('sku must be a non-empty string');
  }

  const query = new URLSearchParams({
    businessClientCode: trimmedBusinessClientCode,
    sku: trimmedSku,
  });

  return await client.request(
    'GET',
    `/consignment-stock?${query.toString()}`,
    JumiaConsignmentStockResponseSchema
  );
}
