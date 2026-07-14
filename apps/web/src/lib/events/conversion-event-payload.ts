import type { NextRequest } from 'next/server';
import type { ConversionEventRequest } from '@/schemas/conversion-event';

function toStoredEventData(input: ConversionEventRequest) {
  return {
    currency: input.custom_data.currency ?? 'NGN',
    item_count: input.custom_data.contents?.length,
    items: input.custom_data.contents,
    order_id: input.custom_data.order_id,
    search_string: input.custom_data.search_string,
    targets: input.targets,
    total: input.custom_data.value,
  };
}

function deliveryData(input: ConversionEventRequest, request: NextRequest) {
  return {
    email: input.user_data.em,
    external_id: input.user_data.external_id,
    fbc: input.user_data.fbc,
    fbp: input.user_data.fbp,
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
    phone: input.user_data.ph,
    sccid: input.user_data.sccid,
    ttclid: input.user_data.ttclid,
    ttp: input.user_data.ttp,
    ua: request.headers.get('user-agent') ?? undefined,
  };
}

export const conversionEventPayload = { deliveryData, toStoredEventData };
