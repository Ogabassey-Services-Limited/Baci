import crypto from 'node:crypto';
import type {
  FacebookCustomData,
  FacebookEvent,
  FacebookEventName,
  FacebookUserData,
} from './facebook-capi-types';

function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

function buildUserData(
  userData: FacebookUserData
): Record<string, string | undefined> {
  const hashed: Record<string, string | undefined> = {};
  if (userData.email) hashed.em = hashData(userData.email);
  if (userData.phone)
    hashed.ph = hashData(userData.phone.replace(/[^\d+]/g, ''));
  if (userData.firstName) hashed.fn = hashData(userData.firstName);
  if (userData.lastName) hashed.ln = hashData(userData.lastName);
  if (userData.city) hashed.ct = hashData(userData.city);
  if (userData.state) hashed.st = hashData(userData.state);
  if (userData.zipCode) hashed.zp = hashData(userData.zipCode);
  if (userData.country) hashed.country = hashData(userData.country);
  if (userData.externalId) hashed.external_id = hashData(userData.externalId);
  if (userData.clientIpAddress)
    hashed.client_ip_address = userData.clientIpAddress;
  if (userData.clientUserAgent)
    hashed.client_user_agent = userData.clientUserAgent;
  if (userData.fbc) hashed.fbc = userData.fbc;
  if (userData.fbp) hashed.fbp = userData.fbp;
  return hashed;
}

function buildCustomData(
  customData: FacebookCustomData
): Record<string, unknown> {
  return {
    ...(customData.value !== undefined ? { value: customData.value } : {}),
    ...(customData.currency ? { currency: customData.currency } : {}),
    ...(customData.contentName ? { content_name: customData.contentName } : {}),
    ...(customData.contentCategory
      ? { content_category: customData.contentCategory }
      : {}),
    ...(customData.contentIds ? { content_ids: customData.contentIds } : {}),
    ...(customData.contentType ? { content_type: customData.contentType } : {}),
    ...(customData.contents ? { contents: customData.contents } : {}),
    ...(customData.numItems !== undefined
      ? { num_items: customData.numItems }
      : {}),
    ...(customData.orderId ? { order_id: customData.orderId } : {}),
    ...(customData.searchString
      ? { search_string: customData.searchString }
      : {}),
    ...(customData.status ? { status: customData.status } : {}),
  };
}

function generateEventId(): string {
  return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function buildEvent(input: {
  customData?: FacebookCustomData;
  eventId?: string;
  eventName: FacebookEventName;
  eventSourceUrl?: string;
  eventTime?: number;
  limitedDataUse?: boolean;
  userData: FacebookUserData;
}): FacebookEvent {
  return {
    action_source: 'website',
    custom_data: input.customData
      ? buildCustomData(input.customData)
      : undefined,
    event_id: input.eventId || generateEventId(),
    event_name: input.eventName,
    event_source_url: input.eventSourceUrl,
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    opt_out: input.limitedDataUse,
    user_data: buildUserData(input.userData),
  };
}

function buildRequestBody(input: {
  accessToken: string;
  event: FacebookEvent;
  limitedDataUse?: boolean;
  testEventCode?: string;
}): Record<string, unknown> {
  return {
    access_token: input.accessToken,
    data: [input.event],
    ...(input.testEventCode ? { test_event_code: input.testEventCode } : {}),
    ...(input.limitedDataUse
      ? {
          data_processing_options: ['LDU'],
          data_processing_options_country: 1,
          data_processing_options_state: 1000,
        }
      : {}),
  };
}

export const facebookCAPIHelpers = {
  buildEvent,
  buildRequestBody,
  generateEventId,
};
