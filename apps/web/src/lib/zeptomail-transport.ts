/**
 * ZeptoMail REST transport
 *
 * POSTs to the ZeptoMail v1.1 API with the platform `fetch` (undici).
 * Replaces the `zeptomail` SDK: its node-fetch@2 transport parses request
 * URLs with the legacy `url.parse()`, which Node flags with a DEP0169
 * DeprecationWarning on every email-sending serverless invocation once the
 * dependency is bundled for deployment (bundled code loses the
 * inside-node_modules warning suppression that hides it in local dev).
 *
 * Error contract, kept compatible with the SDK the callers were written for:
 * - non-2xx with a JSON body rejects with the parsed body
 *   (`{ error: { code, message, details } }` — ZeptoMail's error shape)
 * - network / timeout / non-JSON failures reject with an `Error`
 */

const ZEPTOMAIL_API_BASE_URL = 'https://api.zeptomail.com/v1.1/';

// A send is never retried on timeout — the request may already have been
// accepted server-side, and retrying would risk duplicate customer email —
// so the window can be generous enough for invoice-attachment uploads.
const ZEPTOMAIL_REQUEST_TIMEOUT_MS = 30_000;

export type ZeptoMailEndpoint =
  | 'email'
  | 'email/template'
  | 'email/template/batch';

export interface ZeptoMailApiResponse {
  request_id?: string;
  message?: string;
  data?: unknown;
}

export async function zeptoMailRequest(
  endpoint: ZeptoMailEndpoint,
  payload: Record<string, unknown>,
  token: string
): Promise<ZeptoMailApiResponse> {
  let response: Response;
  try {
    response = await fetch(`${ZEPTOMAIL_API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        // ZEPTOMAIL_TOKEN already carries the full "Zoho-enczapikey …" value.
        Authorization: token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ZEPTOMAIL_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw describeTransportFailure(error);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw (
      body ?? new Error(`ZeptoMail request failed with HTTP ${response.status}`)
    );
  }

  return (body ?? {}) as ZeptoMailApiResponse;
}

function describeTransportFailure(error: unknown): Error {
  if (error instanceof Error) {
    // undici wraps the underlying socket/DNS failure in `cause`; merge it so
    // audit rows record more than a bare "fetch failed".
    const cause = error.cause;
    if (cause instanceof Error && cause.message) {
      return new Error(`${error.message}: ${cause.message}`);
    }
    return error;
  }
  return new Error(String(error));
}
