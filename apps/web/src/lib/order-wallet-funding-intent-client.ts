import { fetchWithCsrf } from '@/lib/api-client';
import {
  type WalletOrderFundingIntent,
  type WalletOrderFundingIntentCreateResponse,
  walletOrderFundingIntentCreateResponseSchema,
  walletOrderFundingIntentPollResponseSchema,
} from '@/schemas/order-wallet-funding-intent';
import {
  type WalletFundingAccountResponse,
  walletFundingAccountSchema,
} from '@/schemas/wallet-funding-account';

const INTENTS_PATH = '/api/storefront/customer/wallet/order-funding-intents';
const FUNDING_ACCOUNT_PATH = '/api/storefront/customer/wallet/funding-account';
// Bounds a single poll: a stalled network must not hang the transfer status
// check indefinitely. A timeout aborts into the `.catch` below as a transport
// error, which the polling loop treats as a retryable failed attempt.
const POLL_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Browser client for the order wallet-funding intent API. Every failure —
 * transport, HTTP, or schema — surfaces as a `WalletOrderFundingIntentError`
 * carrying the API `code` when there is one, so the checkout can decide
 * between "retry with consent" and "fall back to the legacy order DVA".
 * Synthetic codes (`network`, `invalid_response`) have no API counterpart.
 */
export class WalletOrderFundingIntentError extends Error {
  readonly code: string;
  readonly status?: number;
  /**
   * True when the outcome of a *mutating* create POST is NOT provably a no-op:
   * a 5xx (server reached, may have committed before failing), a transport
   * drop/timeout after send (the browser cannot prove the bytes never reached
   * the server), or a 2xx whose body we could not read/parse (the intent was
   * created but its id is lost). The checkout MUST NOT open the legacy
   * order-DVA path on an indeterminate create: an intent may already fund the
   * order, so a second channel risks a double charge or a split order state.
   * Only an explicit 4xx proves the server rejected before any commit.
   */
  readonly indeterminate: boolean;

  constructor(
    message: string,
    code: string,
    status?: number,
    indeterminate = false
  ) {
    super(message);
    this.name = 'WalletOrderFundingIntentError';
    this.code = code;
    this.status = status;
    this.indeterminate = indeterminate;
  }
}

interface ApiErrorBody {
  code?: unknown;
  error?: unknown;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}

async function assertOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }
  const body = await readErrorBody(response);
  const code = typeof body.code === 'string' ? body.code : 'other';
  const message = typeof body.error === 'string' ? body.error : fallbackMessage;
  // 5xx: the server was reached and may have committed the write before it
  // failed → indeterminate. A 4xx is a pre-commit rejection (definite no-op).
  throw new WalletOrderFundingIntentError(
    message,
    code,
    response.status,
    response.status >= 500
  );
}

function toTransportError(
  error: unknown,
  fallbackMessage: string,
  indeterminate = false
): never {
  if (error instanceof WalletOrderFundingIntentError) {
    throw error;
  }
  throw new WalletOrderFundingIntentError(
    error instanceof Error ? error.message : fallbackMessage,
    'network',
    undefined,
    indeterminate
  );
}

export async function createOrderWalletFundingIntent({
  merchantId,
  merchantSlug,
  orderId,
}: {
  merchantId?: string;
  merchantSlug?: string;
  orderId: string;
}): Promise<WalletOrderFundingIntentCreateResponse> {
  // This POST mutates: a transport rejection is INDETERMINATE (the browser
  // cannot prove the request never reached the server — a mid-flight drop after
  // the intent was committed is indistinguishable from a refused connection), so
  // it must never silently fall back to a second funding path.
  const response = await fetchWithCsrf(INTENTS_PATH, {
    body: JSON.stringify({
      ...(merchantId ? { merchantId } : {}),
      ...(merchantSlug ? { merchantSlug } : {}),
      orderId,
    }),
    method: 'POST',
  }).catch((error: unknown) =>
    toTransportError(error, 'Failed to start wallet transfer', true)
  );

  await assertOk(response, 'Failed to start wallet transfer');

  const data = await response.json().catch((error: unknown) =>
    // A 2xx we cannot read still means the server created the intent.
    toTransportError(error, 'Failed to start wallet transfer', true)
  );
  const parsed = walletOrderFundingIntentCreateResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new WalletOrderFundingIntentError(
      'Invalid wallet order funding intent create response',
      'invalid_response',
      undefined,
      // The server answered 2xx, so an intent exists even though the body did
      // not match — treat as committed, not a clean no-op.
      true
    );
  }
  return parsed.data;
}

export async function getOrderWalletFundingIntent({
  intentId,
  merchantId,
  merchantSlug,
}: {
  intentId: string;
  merchantId?: string;
  merchantSlug?: string;
}): Promise<WalletOrderFundingIntent> {
  const query = new URLSearchParams();
  if (merchantId) query.set('merchantId', merchantId);
  if (merchantSlug) query.set('merchantSlug', merchantSlug);

  const response = await fetch(
    `${INTENTS_PATH}/${encodeURIComponent(intentId)}?${query.toString()}`,
    {
      credentials: 'include',
      signal: AbortSignal.timeout(POLL_REQUEST_TIMEOUT_MS),
    }
  ).catch((error: unknown) =>
    // Read-only GET: a transport error (including the timeout abort) stays a
    // retryable `network` error the polling loop retries — never indeterminate.
    toTransportError(error, 'Failed to check transfer status')
  );

  await assertOk(response, 'Failed to check transfer status');

  const data = await response
    .json()
    .catch((error: unknown) =>
      toTransportError(error, 'Failed to check transfer status')
    );
  const parsed = walletOrderFundingIntentPollResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new WalletOrderFundingIntentError(
      'Invalid wallet order funding intent poll response',
      'invalid_response'
    );
  }
  return parsed.data.intent;
}

/**
 * Provisions (or returns) the customer's standing wallet DVA with explicit
 * consent. Only called after the intent API answers
 * `WALLET_DVA_CONSENT_REQUIRED` and the customer accepts — the intent route
 * itself never provisions an account.
 */
export async function createWalletFundingAccount({
  merchantId,
  merchantSlug,
}: {
  merchantId?: string;
  merchantSlug?: string;
}): Promise<WalletFundingAccountResponse> {
  const response = await fetchWithCsrf(FUNDING_ACCOUNT_PATH, {
    body: JSON.stringify({
      consent: true,
      ...(merchantId ? { merchantId } : {}),
      ...(merchantSlug ? { merchantSlug } : {}),
    }),
    method: 'POST',
  }).catch((error: unknown) =>
    toTransportError(error, 'Failed to set up your wallet account')
  );

  await assertOk(response, 'Failed to set up your wallet account');

  const data = (await response
    .json()
    .catch((error: unknown) =>
      toTransportError(error, 'Failed to set up your wallet account')
    )) as { account?: unknown };
  const parsed = walletFundingAccountSchema.safeParse(data.account);
  if (!parsed.success) {
    throw new WalletOrderFundingIntentError(
      'Invalid wallet funding account response',
      'invalid_response'
    );
  }
  return parsed.data;
}
