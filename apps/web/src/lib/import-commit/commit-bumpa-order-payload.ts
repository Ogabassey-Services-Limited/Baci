import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import { mapBumpaOrderSource } from '@/lib/imports/bumpa/map-bumpa-order-source';

export interface ExistingOrderRecord {
  id: string;
  external_id: string | null;
  tracking_token: string;
  updated_at?: string | null;
  fulfillment_details: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
  loaded_from_database?: boolean;
}

function buildShippingAddressPayload(order: NormalizedImportedOrder) {
  if (!order.shippingAddress) {
    return null;
  }

  // Rich Bumpa exports can provide only a formatted full address. Use it as
  // line 1 so receipts and order details still have a printable address.
  const fullAddress = normalizeOptionalString(
    order.shippingAddress.fullAddress
  );
  const addressLine =
    normalizeOptionalString(order.shippingAddress.address) || fullAddress;

  return {
    address: addressLine,
    address_line1: addressLine,
    full_address: fullAddress,
    city: normalizeOptionalString(order.shippingAddress.city),
    state: normalizeOptionalString(order.shippingAddress.state),
    country: normalizeOptionalString(order.shippingAddress.country),
    postal_code: normalizeOptionalString(order.shippingAddress.postalCode),
    source: normalizeOptionalString(order.shippingAddress.source),
  };
}

function isCompleteShippingAddress(
  shippingAddress: ReturnType<typeof buildShippingAddressPayload>
) {
  return Boolean(
    shippingAddress?.address && shippingAddress.city && shippingAddress.state
  );
}

function hasIncomingShippingAddressComponent(
  shippingAddress: ReturnType<typeof buildShippingAddressPayload>
) {
  return Boolean(
    normalizeShippingAddressValue(shippingAddress?.address) ||
      normalizeShippingAddressValue(shippingAddress?.full_address) ||
      normalizeShippingAddressValue(shippingAddress?.city) ||
      normalizeShippingAddressValue(shippingAddress?.state) ||
      normalizeShippingAddressValue(shippingAddress?.country) ||
      normalizeShippingAddressValue(shippingAddress?.postal_code)
  );
}

function hasPrintableStoredShippingAddress(
  shippingAddress: Record<string, unknown> | null
) {
  return Boolean(
    normalizeShippingAddressValue(shippingAddress?.address) ||
      normalizeShippingAddressValue(shippingAddress?.address_line1) ||
      normalizeShippingAddressValue(shippingAddress?.full_address)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeShippingAddressValue(value: unknown) {
  if (typeof value !== 'string') return value ?? null;

  return normalizeOptionalString(value);
}

function compactShippingAddressPayload(
  incomingShippingAddress: ReturnType<typeof buildShippingAddressPayload>
) {
  if (!incomingShippingAddress) return null;
  const compact: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(incomingShippingAddress)) {
    const normalizedValue = normalizeShippingAddressValue(value);
    if (normalizedValue !== null && normalizedValue !== undefined) {
      compact[key] = normalizedValue;
    }
  }

  return Object.keys(compact).length > 0 ? compact : null;
}

function firstString(value: unknown) {
  if (!Array.isArray(value)) return null;

  const found = value.find(
    (candidate) => typeof candidate === 'string' && candidate.trim()
  );

  return typeof found === 'string' ? found.trim() : null;
}

function buildBumpaFulfillmentFields(
  item: NormalizedImportedOrder['items'][0]
) {
  const bumpaMetadata = isRecord(item.importMetadata?.bumpa)
    ? item.importMetadata.bumpa
    : null;
  const identifiers = isRecord(bumpaMetadata?.fulfillment_identifiers)
    ? bumpaMetadata.fulfillment_identifiers
    : null;
  const imei =
    firstString(identifiers?.imeis) ||
    firstString(identifiers?.unlabeledIdentifiers);
  const serialNumber = firstString(identifiers?.serialNumbers);

  return {
    ...(imei ? { imei } : {}),
    ...(serialNumber ? { serialNumber, serial_number: serialNumber } : {}),
  };
}

export function getPreviewExistingOrderUpdatedAt(
  order: NormalizedImportedOrder
) {
  const value = order.importMetadata.previewExistingOrderUpdatedAt;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildPersistedImportMetadata(order: NormalizedImportedOrder) {
  const { previewExistingOrderUpdatedAt: _previewUpdatedAt, ...metadata } =
    order.importMetadata;

  return metadata;
}

export function buildOrderInsertPayload(
  merchantId: string,
  importJobId: string,
  customerId: string,
  order: NormalizedImportedOrder,
  trackingToken: string,
  existingOrder: ExistingOrderRecord | null = null
) {
  const orderSource = mapBumpaOrderSource(
    order.sourceOrigin,
    order.sourceChannel
  );
  const shippingAddress = buildShippingAddressPayload(order);
  const existingShippingAddress = isRecord(existingOrder?.shipping_address)
    ? existingOrder.shipping_address
    : null;
  const hasIncomingShippingAddress =
    hasIncomingShippingAddressComponent(shippingAddress);
  const shouldWriteShippingAddress =
    hasIncomingShippingAddress &&
    (!existingOrder ||
      !hasPrintableStoredShippingAddress(existingShippingAddress) ||
      isCompleteShippingAddress(shippingAddress));
  const shippingAddressToWrite = shouldWriteShippingAddress
    ? compactShippingAddressPayload(shippingAddress)
    : null;
  const fulfillmentDetails = {
    shipping_option: order.shippingOption,
    source_channel: order.sourceChannel,
    source_origin: order.sourceOrigin,
    ...(shouldWriteShippingAddress
      ? { shipping_address_source: shippingAddressToWrite?.source ?? null }
      : {}),
  };

  return {
    merchant_id: merchantId,
    customer_id: customerId,
    order_number: order.orderNumber,
    customer_name: order.customer.fullName,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    shipping_status: order.shippingStatus,
    payment_status: order.paymentStatus,
    total: order.total,
    subtotal: order.subtotal,
    shipping_fee: order.shippingFee,
    tax_amount: order.taxAmount,
    discount_amount: order.discountAmount,
    amount_paid: order.amountPaid,
    currency: order.currency,
    original_currency: order.currency,
    original_total: order.total,
    payment_method: 'imported',
    source: orderSource,
    notes: order.shippingOption
      ? `Imported from Bumpa (${order.shippingOption})`
      : 'Imported from Bumpa',
    fulfillment_details: fulfillmentDetails,
    ...(shippingAddressToWrite
      ? { shipping_address: shippingAddressToWrite }
      : {}),
    tracking_token: trackingToken,
    created_at: order.createdAt,
    updated_at: order.updatedAt ?? order.createdAt,
    external_source: order.sourcePlatform,
    external_id: order.externalSourceId,
    import_job_id: importJobId,
    imported_at: new Date().toISOString(),
    import_metadata: buildPersistedImportMetadata(order),
  };
}

export function buildCachedOrderRecord(
  orderId: string,
  order: NormalizedImportedOrder,
  trackingToken: string,
  payload: ReturnType<typeof buildOrderInsertPayload>,
  selectedRecord: Partial<ExistingOrderRecord> | null
): ExistingOrderRecord {
  const selectedFulfillmentDetails = isRecord(
    selectedRecord?.fulfillment_details
  )
    ? selectedRecord.fulfillment_details
    : null;
  const selectedShippingAddress = isRecord(selectedRecord?.shipping_address)
    ? selectedRecord.shipping_address
    : null;

  return {
    id: orderId,
    external_id:
      typeof selectedRecord?.external_id === 'string'
        ? selectedRecord.external_id
        : order.externalSourceId,
    tracking_token:
      typeof selectedRecord?.tracking_token === 'string'
        ? selectedRecord.tracking_token
        : trackingToken,
    updated_at:
      typeof selectedRecord?.updated_at === 'string'
        ? selectedRecord.updated_at
        : typeof payload.updated_at === 'string'
          ? payload.updated_at
          : null,
    fulfillment_details:
      selectedFulfillmentDetails ??
      (isRecord(payload.fulfillment_details)
        ? payload.fulfillment_details
        : null),
    shipping_address:
      selectedShippingAddress ??
      (isRecord(payload.shipping_address) ? payload.shipping_address : null),
    loaded_from_database: false,
  };
}

export function buildOrderItems(
  orderId: string,
  order: NormalizedImportedOrder
) {
  return order.items.map((item, index) => ({
    order_id: orderId,
    product_id: item.productId,
    name: item.productName,
    price: item.unitPrice,
    quantity: item.quantity,
    line_id: index + 1,
    line_extension_amount: item.lineTotal,
    item_description: item.productName,
    sellers_item_id: item.sku,
    fulfillment_data: {
      ...(item.importMetadata || {}),
      source_platform: order.sourcePlatform,
      match_source: item.matchSource,
      matched: item.matched,
      ...buildBumpaFulfillmentFields(item),
    },
    created_at: order.createdAt,
  }));
}
