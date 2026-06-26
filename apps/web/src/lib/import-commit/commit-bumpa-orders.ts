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

  return {
    address: order.shippingAddress.address,
    full_address: order.shippingAddress.fullAddress,
    city: order.shippingAddress.city,
    state: order.shippingAddress.state,
    country: order.shippingAddress.country,
    postal_code: order.shippingAddress.postalCode,
    source: order.shippingAddress.source,
  };
}

async function loadExistingImportedOrders(
  supabase: SupabaseClient,
  merchantId: string
) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, external_id, tracking_token')
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
  trackingToken: string
) {
  const orderSource = mapBumpaOrderSource(
    order.sourceOrigin,
    order.sourceChannel
  );
  const shippingAddress = buildShippingAddressPayload(order);

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
    fulfillment_details: {
      shipping_option: order.shippingOption,
      source_channel: order.sourceChannel,
      source_origin: order.sourceOrigin,
      shipping_address_source: order.shippingAddress?.source ?? null,
    },
    shipping_address: shippingAddress,
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
      source_platform: order.sourcePlatform,
      match_source: item.matchSource,
      matched: item.matched,
      ...(item.importMetadata || {}),
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
    const payload = buildOrderInsertPayload(
      merchantId,
      importJobId,
      customerId,
      order,
      existingOrder?.tracking_token || nanoid(32)
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
    } else {
      const { data, error } = await supabase
        .from('orders')
        .insert(payload)
        .select('id, external_id, tracking_token')
        .single();

      if (error || !data) {
        throw new Error(`Failed to create imported order: ${error?.message}`);
      }

      const createdOrder = data as ExistingOrderRecord;
      orderId = createdOrder.id;
      ordersByExternalId.set(order.externalSourceId, createdOrder);
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
