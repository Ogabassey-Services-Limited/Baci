const MONNIFY_SUCCESS_RESPONSE_CODE = '0';

export const MONNIFY_DISCOVERY_TIMEOUT_MS = 10_000;
export const MONNIFY_FINANCIAL_TIMEOUT_MS = 30_000;
export const MONNIFY_DISCOVERY_CACHE = {
  expire: 3600,
  revalidate: 300,
  stale: 60,
};

export interface MonnifyDiscoveryOptions {
  signal?: AbortSignal;
}

export function getMonnifyEnvelopeMessage({
  fallback,
  responseCode,
  responseMessage,
}: {
  fallback: string;
  responseCode?: string;
  responseMessage?: string;
}) {
  const message = responseMessage?.trim();
  const code = responseCode?.trim();
  if (message && code) {
    return `${message} (${code})`;
  }
  return message || code || fallback;
}

export function isMonnifyBusinessSuccess(envelope: {
  requestSuccessful: boolean;
  responseCode: string;
}) {
  return (
    envelope.requestSuccessful &&
    envelope.responseCode === MONNIFY_SUCCESS_RESPONSE_CODE
  );
}

export function assertMonnifyBusinessSuccess(
  envelope: {
    requestSuccessful: boolean;
    responseCode: string;
    responseMessage?: string;
  },
  operation: string
) {
  if (isMonnifyBusinessSuccess(envelope)) {
    return;
  }

  throw new Error(
    `${operation} failed: ${getMonnifyEnvelopeMessage({
      fallback: 'Monnify business failure',
      responseCode: envelope.responseCode,
      responseMessage: envelope.responseMessage,
    })}`
  );
}
