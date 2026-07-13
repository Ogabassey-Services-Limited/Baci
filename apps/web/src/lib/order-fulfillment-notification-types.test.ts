import { describe, expectTypeOf, it } from 'vitest';
import type {
  FeatureSettingsRecord,
  FulfillmentOrderItemRecord,
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationEventType,
  OrderFulfillmentNotificationResult,
} from './order-fulfillment-notification-types';

describe('order fulfillment notification contracts', () => {
  it('accepts both fulfillment event types and every result variant', () => {
    expectTypeOf<'order_shipped'>().toMatchTypeOf<OrderFulfillmentNotificationEventType>();
    expectTypeOf<'order_delivered'>().toMatchTypeOf<OrderFulfillmentNotificationEventType>();
    expectTypeOf<{
      status: 'sent';
      message: string;
      messageId?: string;
      hasGoogleRating?: boolean;
    }>().toMatchTypeOf<OrderFulfillmentNotificationResult>();
    expectTypeOf<{
      status: 'skipped';
      reason: 'notification_processing';
      hasGoogleRating?: boolean;
    }>().toMatchTypeOf<OrderFulfillmentNotificationResult>();
    expectTypeOf<{
      status: 'failed';
      deliveryOutcome?: 'unknown';
      error: string;
      details?: unknown;
    }>().toMatchTypeOf<OrderFulfillmentNotificationResult>();
    expectTypeOf<{
      status: 'invalid_state';
      error: string;
    }>().toMatchTypeOf<OrderFulfillmentNotificationResult>();
    expectTypeOf<{
      status: 'not_found';
      error: string;
    }>().toMatchTypeOf<OrderFulfillmentNotificationResult>();
  });

  it('accepts the persisted merchant, order, item, and feature shapes', () => {
    expectTypeOf<{
      id: string;
      business_name: string;
      slug: string;
      support_email: null;
      email_sender_name: null;
      email: null;
      cac_rc_number?: string | null;
      tax_identification_number?: string | null;
    }>().toMatchTypeOf<MerchantRecord>();
    expectTypeOf<{
      id: string;
      customer_name: string;
      order_number: null;
      order_items: FulfillmentOrderItemRecord[];
      shipping_status: 'out_for_delivery';
      shipping_address?: {
        address?: string | null;
        city?: string | null;
        state?: string | null;
      } | null;
    }>().toMatchTypeOf<FulfillmentOrderRecord>();
    expectTypeOf<{
      name: null;
      quantity: null;
    }>().toMatchTypeOf<FulfillmentOrderItemRecord>();
    expectTypeOf<{
      google_place_id: null;
    }>().toMatchTypeOf<FeatureSettingsRecord>();
  });
});
