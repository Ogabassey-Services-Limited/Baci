import { z } from 'zod';
import { logger } from '@/lib/logger';
import { sendFulfillmentNotificationEmail } from '@/lib/order-fulfillment-notification-senders';
import type {
  FeatureSettingsRecord,
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationEventType,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';

export type {
  OrderFulfillmentNotificationEventType,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';

interface SendOrderFulfillmentNotificationParams {
  courierName?: string;
  estimatedDelivery?: string;
  eventType: OrderFulfillmentNotificationEventType;
  merchantId: string;
  mismatchBehavior?: 'skip' | 'invalid_state';
  orderId: string;
  supabase: {
    from: (table: string) => unknown;
  };
  trackingNumber?: string;
}

const merchantSchema = z.object({
  id: z.string().min(1),
  business_name: z.string().min(1),
  slug: z.string().min(1),
  support_email: z.string().nullable(),
  email_sender_name: z.string().nullable(),
  email: z.string().nullable(),
  tax_identification_number: z.string().nullable().optional(),
  cac_rc_number: z.string().nullable().optional(),
});

const fulfillmentShippingStatusSchema = z.enum([
  'pending',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'canceled',
  'returned',
]);

const fulfillmentOrderSchema = z.object({
  id: z.string().min(1),
  customer_id: z.string().nullable().optional(),
  order_number: z.string().nullable(),
  customer_name: z.string().min(1),
  customer_email: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  shipping_status: fulfillmentShippingStatusSchema,
  shipping_provider: z.string().nullable().optional(),
  tracking_number: z.string().nullable().optional(),
  tracking_token: z.string().nullable().optional(),
  shipping_address: z
    .object({
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  order_items: z
    .array(
      z.object({
        name: z.string().nullable(),
        quantity: z.number().nullable(),
      })
    )
    .nullable(),
});

const featureSettingsSchema = z.object({
  google_place_id: z.string().nullable(),
});

type QueryBuilder = {
  eq: (column: string, value: unknown) => QueryBuilder;
  maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
  select: (columns: string) => QueryBuilder;
  single: () => Promise<{ data: unknown; error: unknown }>;
};

function tableQuery(
  supabase: SendOrderFulfillmentNotificationParams['supabase'],
  table: string
): QueryBuilder {
  return supabase.from(table) as QueryBuilder;
}

function getRequiredShippingStatusMessage(
  eventType: OrderFulfillmentNotificationEventType
): 'shipped' | 'delivered' {
  return eventType === 'order_shipped' ? 'shipped' : 'delivered';
}

function isOrderInRequiredShippingStatus(
  eventType: OrderFulfillmentNotificationEventType,
  shippingStatus: z.infer<typeof fulfillmentShippingStatusSchema>
): boolean {
  if (eventType === 'order_shipped') {
    return shippingStatus === 'shipped';
  }

  return shippingStatus === 'delivered' || shippingStatus === 'completed';
}

async function loadMerchant(
  supabase: SendOrderFulfillmentNotificationParams['supabase'],
  merchantId: string
): Promise<MerchantRecord | null | 'invalid'> {
  const { data, error } = await tableQuery(supabase, 'merchants')
    .select(
      'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
    )
    .eq('id', merchantId)
    .single();

  if (error || !data) {
    logger.warn({
      message: 'Order notification merchant not found',
      merchantId,
      error,
    });
    return null;
  }

  const parsed = merchantSchema.safeParse(data);
  if (!parsed.success) {
    logger.error({
      message: 'Invalid merchant payload for order notification',
      merchantId,
      error: z.flattenError(parsed.error),
    });
    return 'invalid';
  }

  return parsed.data;
}

async function loadOrder(
  supabase: SendOrderFulfillmentNotificationParams['supabase'],
  merchantId: string,
  orderId: string
): Promise<FulfillmentOrderRecord | null | 'invalid'> {
  const { data, error } = await tableQuery(supabase, 'orders')
    .select(ORDER_WITH_ITEMS_QUERY)
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();

  if (error || !data) {
    logger.warn({
      message: 'Order notification order not found',
      orderId,
      merchantId,
      error,
    });
    return null;
  }

  const parsed = fulfillmentOrderSchema.safeParse(data);
  if (!parsed.success) {
    logger.error({
      message: 'Invalid order payload for fulfillment notification',
      orderId,
      merchantId,
      error: z.flattenError(parsed.error),
    });
    return 'invalid';
  }

  return parsed.data;
}

async function loadFeatureSettings(
  supabase: SendOrderFulfillmentNotificationParams['supabase'],
  merchantId: string,
  orderId: string
): Promise<FeatureSettingsRecord | null> {
  const query = tableQuery(supabase, 'merchant_feature_settings')
    .select('google_place_id')
    .eq('merchant_id', merchantId);
  const { data, error } = query.maybeSingle
    ? await query.maybeSingle()
    : await query.single();

  if (error) {
    logger.warn({
      message:
        'Failed to fetch merchant feature settings for delivered notification',
      error,
      merchantId,
      orderId,
    });
    return null;
  }

  if (!data) return null;

  const parsed = featureSettingsSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn({
      message: 'Invalid merchant feature settings for delivered notification',
      error: z.flattenError(parsed.error),
      merchantId,
      orderId,
    });
    return null;
  }

  return parsed.data;
}

export async function sendOrderFulfillmentNotification({
  courierName,
  estimatedDelivery,
  eventType,
  merchantId,
  mismatchBehavior = 'skip',
  orderId,
  supabase,
  trackingNumber,
}: SendOrderFulfillmentNotificationParams): Promise<OrderFulfillmentNotificationResult> {
  const [merchant, order] = await Promise.all([
    loadMerchant(supabase, merchantId),
    loadOrder(supabase, merchantId, orderId),
  ]);

  if (!merchant || !order) {
    return { status: 'not_found', error: 'Order or merchant not found' };
  }

  if (merchant === 'invalid') {
    return { status: 'failed', error: 'Invalid merchant payload' };
  }

  if (order === 'invalid') {
    return { status: 'failed', error: 'Invalid order payload' };
  }

  if (!isOrderInRequiredShippingStatus(eventType, order.shipping_status)) {
    if (mismatchBehavior === 'invalid_state') {
      const requiredStatus = getRequiredShippingStatusMessage(eventType);
      return {
        status: 'invalid_state',
        error: `Order must be marked as ${requiredStatus} first`,
      };
    }

    return { status: 'skipped', reason: 'order_not_in_required_status' };
  }

  if (eventType === 'order_shipped') {
    return sendFulfillmentNotificationEmail({
      courierName,
      estimatedDelivery,
      eventType,
      merchant,
      merchantId,
      order,
      trackingNumber,
    });
  }

  const featureSettings = await loadFeatureSettings(
    supabase,
    merchantId,
    orderId
  );
  return sendFulfillmentNotificationEmail({
    eventType,
    featureSettings,
    merchant,
    merchantId,
    order,
  });
}
