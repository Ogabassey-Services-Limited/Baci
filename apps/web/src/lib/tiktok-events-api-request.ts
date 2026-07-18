import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';
import { tiktokEventsAPIHelpers } from './tiktok-events-api-helpers';
import type {
  TikTokEventName,
  TikTokEventOptions,
  TikTokEventProperties,
  TikTokEventResult,
  TikTokUserData,
} from './tiktok-events-api-types';

const TIKTOK_API_URL =
  'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

function readProviderMessage(value: unknown): string {
  return value &&
    typeof value === 'object' &&
    'message' in value &&
    typeof value.message === 'string'
    ? value.message
    : 'Unknown error';
}

function readProviderCode(value: unknown): number | null {
  return value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'number'
    ? value.code
    : null;
}

export async function sendTikTokEvent(
  pixelId: string,
  accessToken: string,
  eventName: TikTokEventName,
  userData: TikTokUserData,
  properties?: TikTokEventProperties,
  eventOptions?: TikTokEventOptions | string,
  testEventCode?: string,
  signal?: AbortSignal
): Promise<TikTokEventResult> {
  if (!pixelId || !accessToken) {
    return { success: false, error: 'Missing pixel ID or access token' };
  }
  const baseOptions =
    typeof eventOptions === 'string'
      ? { eventId: eventOptions, testEventCode }
      : eventOptions;
  const options = {
    ...baseOptions,
    testEventCode: baseOptions?.testEventCode ?? testEventCode,
  };
  const sensitiveValues = [pixelId, accessToken, options?.testEventCode].filter(
    (value): value is string => Boolean(value)
  );
  const payload = tiktokEventsAPIHelpers.buildPayload({
    eventName,
    options,
    properties,
    userData,
  });

  try {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(TIKTOK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        event_source: 'web',
        event_source_id: pixelId,
        data: [payload],
        ...(options?.testEventCode
          ? { test_event_code: options.testEventCode }
          : {}),
      }),
      signal: requestSignal,
    });
    const responseData: unknown = await response.json().catch(() => null);
    if (!response.ok || readProviderCode(responseData) !== 0) {
      const safeMessage = sanitizeEventErrorMessage(
        responseData === null
          ? 'Invalid provider response'
          : readProviderMessage(responseData),
        sensitiveValues
      );
      console.error(
        sanitizeEventErrorMessage('TikTok Events API error:', sensitiveValues),
        safeMessage
      );
      return {
        error: safeMessage,
        httpStatus: response.status,
        success: false,
      };
    }
    return { success: true };
  } catch (error) {
    const safeMessage = sanitizeEventErrorMessage(
      error instanceof Error ? error.message : 'Network error',
      sensitiveValues
    );
    console.error(
      sanitizeEventErrorMessage(
        'TikTok Events API request failed:',
        sensitiveValues
      ),
      safeMessage
    );
    return { error: safeMessage, success: false };
  }
}
