import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';
import { facebookCAPIHelpers } from './facebook-capi-helpers';
import type {
  FacebookCAPIResponse,
  FacebookCAPIResult,
  FacebookCustomData,
  FacebookEventName,
  FacebookUserData,
} from './facebook-capi-types';

const FB_API_VERSION = 'v21.0';
const FB_GRAPH_API = 'https://graph.facebook.com';
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

function readProviderError(value: unknown): {
  code?: number | string;
  message: string;
  traceId?: string;
  type?: string;
} | null {
  if (!value || typeof value !== 'object' || !('error' in value)) return null;
  const error = value.error;
  if (!error || typeof error !== 'object') return null;
  return {
    code:
      'code' in error &&
      (typeof error.code === 'number' || typeof error.code === 'string')
        ? error.code
        : undefined,
    message:
      'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unknown error',
    traceId:
      'fbtrace_id' in error && typeof error.fbtrace_id === 'string'
        ? error.fbtrace_id
        : undefined,
    type:
      'type' in error && typeof error.type === 'string'
        ? error.type
        : undefined,
  };
}

function projectSafeResponse(value: unknown): FacebookCAPIResponse | null {
  if (
    value &&
    typeof value === 'object' &&
    'events_received' in value &&
    typeof value.events_received === 'number'
  ) {
    return { events_received: value.events_received };
  }
  return null;
}

async function readResponseJson(response: Response): Promise<unknown | null> {
  try {
    if (typeof response.text === 'function') {
      const body = await response.text();
      return body.trim() ? (JSON.parse(body) as unknown) : null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function sendFacebookCAPIEvent(
  pixelId: string,
  accessToken: string,
  eventName: FacebookEventName,
  userData: FacebookUserData,
  customData?: FacebookCustomData,
  eventSourceUrl?: string,
  eventId?: string,
  limitedDataUse?: boolean,
  signal?: AbortSignal,
  eventTime?: number
): Promise<FacebookCAPIResult> {
  if (!pixelId || !accessToken) {
    return { success: false, error: 'Missing pixel ID or access token' };
  }
  const sensitiveValues = [pixelId, accessToken].filter(
    (value): value is string => Boolean(value)
  );
  const event = facebookCAPIHelpers.buildEvent({
    customData,
    eventId,
    eventName,
    eventSourceUrl,
    eventTime,
    limitedDataUse,
    userData,
  });
  const requestBody = facebookCAPIHelpers.buildRequestBody({
    accessToken,
    event,
    limitedDataUse,
  });

  try {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(
      `${FB_GRAPH_API}/${FB_API_VERSION}/${pixelId}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: requestSignal,
      }
    );
    const responseData = await readResponseJson(response);
    if (!response.ok) {
      const providerError = readProviderError(responseData);
      const fallback = `Facebook CAPI returned HTTP ${response.status}`;
      const safeMessage = sanitizeEventErrorMessage(
        providerError?.message ?? fallback,
        sensitiveValues
      );
      const diagnostic = providerError
        ? `Facebook CAPI error${providerError.type ? ` [${providerError.type}]` : ''}${
            providerError.code !== undefined
              ? ` (code ${providerError.code})`
              : ''
          }: ${providerError.message}${
            providerError.traceId
              ? ` [fbtrace_id: ${providerError.traceId}]`
              : ''
          }`
        : fallback;
      console.error(sanitizeEventErrorMessage(diagnostic, sensitiveValues));
      return {
        error: safeMessage,
        httpStatus: response.status,
        success: false,
      };
    }
    const safeResponse = projectSafeResponse(responseData);
    if (!safeResponse) {
      const safeMessage = 'Malformed Facebook CAPI response';
      console.error(safeMessage);
      return {
        error: safeMessage,
        httpStatus: response.status,
        success: false,
      };
    }
    return { response: safeResponse, success: true };
  } catch (error) {
    const safeMessage = sanitizeEventErrorMessage(
      error instanceof Error ? error.message : 'Network error',
      sensitiveValues
    );
    console.error(
      sanitizeEventErrorMessage(
        'Facebook CAPI request failed:',
        sensitiveValues
      ),
      safeMessage
    );
    return { error: safeMessage, success: false };
  }
}
