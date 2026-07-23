import crypto from 'node:crypto';
import type {
  TikTokEventName,
  TikTokEventOptions,
  TikTokEventProperties,
  TikTokUserData,
} from './tiktok-events-api-types';

const MILLISECOND_TIMESTAMP_THRESHOLD = 1_000_000_000_000;

function compactRecord<T extends Record<string, unknown>>(
  record: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function normalizeUnixSeconds(value: number): number {
  return Math.floor(
    value > MILLISECOND_TIMESTAMP_THRESHOLD ? value / 1000 : value
  );
}

function toEventTime(eventTime: Date | number | string | undefined): number {
  if (eventTime instanceof Date) {
    const timestamp = eventTime.getTime();
    return Number.isFinite(timestamp) && timestamp > 0
      ? Math.floor(timestamp / 1000)
      : currentUnixSeconds();
  }
  if (typeof eventTime === 'number') {
    return Number.isFinite(eventTime) && eventTime > 0
      ? normalizeUnixSeconds(eventTime)
      : currentUnixSeconds();
  }
  if (typeof eventTime === 'string') {
    const trimmedTime = eventTime.trim();
    if (!trimmedTime) return currentUnixSeconds();
    const numericTime = Number(trimmedTime);
    if (Number.isFinite(numericTime)) {
      return numericTime > 0
        ? normalizeUnixSeconds(numericTime)
        : currentUnixSeconds();
    }
    const parsedTime = Date.parse(trimmedTime);
    if (Number.isFinite(parsedTime)) return Math.floor(parsedTime / 1000);
  }
  return currentUnixSeconds();
}

function buildUserData(
  userData: TikTokUserData
): Partial<Record<string, unknown>> {
  return compactRecord({
    email: userData.email ? hashData(userData.email) : undefined,
    external_id: userData.externalId
      ? hashData(userData.externalId)
      : undefined,
    ip: userData.ipAddress,
    phone: userData.phone
      ? hashData(userData.phone.replace(/[^\d+]/g, ''))
      : undefined,
    ttclid: userData.ttclid,
    ttp: userData.ttp,
    user_agent: userData.userAgent,
  });
}

function buildProperties(
  properties?: TikTokEventProperties
): Record<string, unknown> {
  return {
    ...(properties?.value !== undefined ? { value: properties.value } : {}),
    ...(properties?.currency ? { currency: properties.currency } : {}),
    ...(properties?.contentId ? { content_id: properties.contentId } : {}),
    ...(properties?.contentIds ? { content_ids: properties.contentIds } : {}),
    ...(properties?.contentName
      ? { content_name: properties.contentName }
      : {}),
    ...(properties?.contentType
      ? { content_type: properties.contentType }
      : {}),
    ...(properties?.price !== undefined ? { price: properties.price } : {}),
    ...(properties?.contents ? { contents: properties.contents } : {}),
    ...(properties?.query ? { search_string: properties.query } : {}),
    ...(properties?.searchString
      ? { search_string: properties.searchString }
      : {}),
    ...(properties?.orderId ? { order_id: properties.orderId } : {}),
  };
}

function buildPayload(input: {
  eventName: TikTokEventName;
  options?: TikTokEventOptions;
  properties?: TikTokEventProperties;
  userData: TikTokUserData;
}) {
  return {
    event: input.eventName,
    event_id:
      input.options?.eventId ||
      `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
    event_time: toEventTime(input.options?.eventTime),
    page: compactRecord({ url: input.options?.url || input.properties?.url }),
    properties: buildProperties(input.properties),
    user: buildUserData(input.userData),
  };
}

function withFirstContent(
  properties: TikTokEventProperties
): TikTokEventProperties {
  const firstContent = properties.contents?.[0];
  return {
    ...properties,
    contentId: properties.contentId || firstContent?.content_id,
    contentName: properties.contentName || firstContent?.content_name,
    contentType: properties.contentType || 'product',
    price: properties.price ?? firstContent?.price,
  };
}

export const tiktokEventsAPIHelpers = {
  buildPayload,
  withFirstContent,
};
