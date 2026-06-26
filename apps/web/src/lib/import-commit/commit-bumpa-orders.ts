import type { SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import { mapBumpaOrderSource } from '@/lib/imports/bumpa/map-bumpa-order-source';
import { createImportCustomerResolver } from './resolve-import-customer';

interface CommitBumpaOrdersInput {
  supabase: SupabaseClient;
  merchantId: string;
  importJobId: string;
  orders: NormalizedImportedOrder[];
}

interface ExistingOrderRecord {
  id: string;
  external_id: string | null;
  tracking_token: string;
  fulfillment_details: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
}

interface CommitBumpaOrdersResult {
  createdOrders: number;
  updatedOrders: number;
  createdCustomers: number;
}

function buildShippingAddressPayload(order: NormalizedImportedOrder) {
  if (!order.shippingAddress) {
    return null;
  }

  // Rich Bumpa exports can provide only a formatted full address. Use it as
  // line 1 so receipts and order details still have a printable address.
  const addressLine =
    order.shippingAddress.address || order.shippingAddress.fullAddress;

  return {
    address: addressLine,
    address_line1: addressLine,
    full_address: order.shippingAddress.fullAddress,
    city: order.shippingAddress.city,
    state: order.shippingAddress.state,
    country: order.shippingAddress.country,
    postal_code: order.shippingAddress.postalCode,
    source: order.shippingAddress.source,
  };
}

function isCompleteShippingAddress(
  shippingAddress: ReturnType<typeof buildShippingAddressPayload>
) {
  return Boolean(
    shippingAddress?.address && shippingAddress.city && shippingAddress.state
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeShippingAddressPayload(
  existingShippingAddress: Record<string, unknown> | null,
  incomingShippingAddress: ReturnType<typeof buildShippingAddressPayload>
) {
  if (!incomingShippingAddress) return null;
  const merged = { ...(existingShippingAddress ?? {}) };

  for (const [key, value] of Object.entries(incomingShippingAddress)) {
    if (value !== null && value !== undefined && value !== '') {
      merged[key] = value;
    }
  }

  return merged;
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

async function loadExistingImportedOrders(
  supabase: SupabaseClient,
  merchantId: string
) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, external_id, tracking_token, fulfillment_details, shipping_address'
    )
    .eq('merchant_id', merchantId)
    .eq('external_source', 'bumpa');

  if (error) {
    throw new Error(
      `Failed to load existing imported orders: ${error.message}`
    );
  }

  return (data || []) as ExistingOrderRecord[];
}

function buildOrderInsertPayload(
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
  const hasIncomingShippingAddress = Boolean(
    shippingAddress?.address || shippingAddress?.full_address
  );
  const shouldWriteShippingAddress =
    hasIncomingShippingAddress &&
    (!existingOrder ||
      !existingShippingAddress ||
      isCompleteShippingAddress(shippingAddress));
  const shippingAddressToWrite = shouldWriteShippingAddress
    ? mergeShippingAddressPayload(existingShippingAddress, shippingAddress)
    : null;
  const existingFulfillmentDetails = isRecord(
    existingOrder?.fulfillment_details
  )
    ? existingOrder.fulfillment_details
    : {};
  const fulfillmentDetails = {
    ...existingFulfillmentDetails,
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
    import_metadata: order.importMetadata,
  };
}

function buildCachedOrderRecord(
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
    fulfillment_details: isRecord(payload.fulfillment_details)
      ? payload.fulfillment_details
      : selectedFulfillmentDetails,
    shipping_address: isRecord(payload.shipping_address)
      ? payload.shipping_address
      : selectedShippingAddress,
  };
}

function buildOrderItems(orderId: string, order: NormalizedImportedOrder) {
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

export async function commitBumpaOrders({
  supabase,
  merchantId,
  importJobId,
  orders,
}: CommitBumpaOrdersInput): Promise<CommitBumpaOrdersResult> {
  const [customerResolver, existingOrders] = await Promise.all([
    createImportCustomerResolver(supabase, merchantId),
    loadExistingImportedOrders(supabase, merchantId),
  ]);

  const ordersByExternalId = new Map<string, ExistingOrderRecord>();
  for (const existingOrder of existingOrders) {
    if (existingOrder.external_id) {
      ordersByExternalId.set(existingOrder.external_id, existingOrder);
    }
  }

  let createdOrders = 0;
  let updatedOrders = 0;
  let createdCustomers = 0;

  for (const order of orders) {
    const { customerId, createdCustomer } =
      await customerResolver.resolveCustomerId(supabase, order);
    if (createdCustomer) {
      createdCustomers += 1;
    }

    const existingOrder = ordersByExternalId.get(order.externalSourceId);
    const trackingToken = existingOrder?.tracking_token || nanoid(32);
    const payload = buildOrderInsertPayload(
      merchantId,
      importJobId,
      customerId,
      order,
      trackingToken,
      existingOrder
    );

    let orderId = existingOrder?.id || null;
    if (existingOrder) {
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', existingOrder.id);

      if (error) {
        throw new Error(`Failed to update imported order: ${error.message}`);
      }

      updatedOrders += 1;
      ordersByExternalId.set(
        order.externalSourceId,
        buildCachedOrderRecord(
          existingOrder.id,
          order,
          trackingToken,
          payload,
          existingOrder
        )
      );
    } else {
      const { data, error } = await supabase
        .from('orders')
        .insert(payload)
        .select(
          'id, external_id, tracking_token, fulfillment_details, shipping_address'
        )
        .single();

      if (error || !data) {
        throw new Error(`Failed to create imported order: ${error?.message}`);
      }

      const createdOrder = data as ExistingOrderRecord;
      orderId = createdOrder.id;
      ordersByExternalId.set(
        order.externalSourceId,
        buildCachedOrderRecord(
          createdOrder.id,
          order,
          trackingToken,
          payload,
          createdOrder
        )
      );
      createdOrders += 1;
    }

    if (!orderId) {
      throw new Error('Imported order is missing an id after commit');
    }

    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (deleteItemsError) {
      throw new Error(
        `Failed to reset imported order items: ${deleteItemsError.message}`
      );
    }

    const orderItems = buildOrderItems(orderId, order);
    if (orderItems.length === 0) {
      continue;
    }

    const { error: insertItemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (insertItemsError) {
      throw new Error(
        `Failed to insert imported order items: ${insertItemsError.message}`
      );
    }
  }

  return {
    createdOrders,
    updatedOrders,
    createdCustomers,
  };
}
