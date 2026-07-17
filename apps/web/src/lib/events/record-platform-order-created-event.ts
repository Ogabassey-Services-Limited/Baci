import { isEventPipelineEnqueueEnabled } from '@/lib/events/event-pipeline-config';
import { recordPlatformDomainEvent } from '@/lib/events/record-platform-domain-event';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

type PlatformOrderCreatedEvent = {
  currency: string;
  customerEmail?: string;
  eventTimestamp: string;
  ipAddress?: string;
  merchantId: string;
  orderId: string;
  orderNumber: string;
  userAgent?: string;
  value: number;
};

export async function recordPlatformOrderCreatedEvent(
  input: PlatformOrderCreatedEvent
): Promise<void> {
  if (!isEventPipelineEnqueueEnabled()) return;

  try {
    await recordPlatformDomainEvent(createAdminClient('event-pipeline'), {
      deliveryData: {
        email: input.customerEmail,
        ip: input.ipAddress,
        ua: input.userAgent,
      },
      eventData: {
        currency: input.currency,
        order_id: input.orderNumber,
        value: input.value,
      },
      eventName: 'platform.platform_purchase.v1',
      eventTimestamp: input.eventTimestamp,
      eventType: 'platform_purchase',
      externalEventId: `platform_purchase:${input.orderId}`,
      merchantId: input.merchantId,
      producer: 'worker',
      trustLevel: 'server',
    });
  } catch (error) {
    logger.error({
      message: 'Platform order event enqueue failed',
      merchantId: input.merchantId,
      orderId: input.orderId,
      error,
    });
  }
}
