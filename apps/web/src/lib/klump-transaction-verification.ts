import type { KlumpWebhookDetails } from '@/lib/klump-webhook';
import {
  amountsMatch,
  currenciesMatch,
  type JsonRecord,
} from '@/lib/klump-webhook';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface KlumpVerifiedTransactionDetails {
  amount: number;
  currency: string | null;
  isLive: boolean | null;
  merchantReference: string | null;
  status: string | null;
  transactionId: string;
}

interface KlumpTransactionRecord {
  amount: number | string | null;
  currency: string | null;
}

const KLUMP_SUCCESS_STATUSES = new Set([
  'paid',
  'success',
  'successful',
  'completed',
]);
const KLUMP_TRANSACTION_VERIFICATION_BASE_URL =
  'https://api.useklump.com/v1/transactions';
const KLUMP_TRANSACTION_VERIFICATION_TIMEOUT_MS = 10_000;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readString(sources: readonly JsonRecord[], keys: readonly string[]) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

function readNumber(sources: readonly JsonRecord[], keys: readonly string[]) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : Number.NaN;
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function readBoolean(sources: readonly JsonRecord[], keys: readonly string[]) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'boolean') {
        return value;
      }
    }
  }

  return null;
}

function parseKlumpVerifiedTransactionResponse(
  response: unknown
): KlumpVerifiedTransactionDetails | null {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const transaction = asRecord(data.transaction);
  const sources = [transaction, data, root];
  const status = readString(sources, [
    'status',
    'payment_status',
    'transaction_status',
  ]);

  if (!KLUMP_SUCCESS_STATUSES.has(status?.toLowerCase() ?? '')) {
    return null;
  }

  const transactionId = readString(sources, [
    'id',
    'transaction_id',
    'transactionId',
    'checkout_transaction_id',
    'checkoutTransactionId',
  ]);
  const amount = readNumber(sources, ['amount', 'total_amount', 'totalAmount']);

  if (!(transactionId && amount)) {
    return null;
  }

  return {
    amount,
    currency: readString(sources, ['currency']),
    isLive: readBoolean(sources, ['is_live', 'isLive']),
    merchantReference: readString(sources, [
      'merchant_reference',
      'merchantReference',
      'reference',
      'tx_ref',
      'txRef',
    ]),
    status,
    transactionId,
  };
}

async function verifyKlumpTransactionWithProvider({
  fetcher = fetch,
  secretKey,
  timeoutMs = KLUMP_TRANSACTION_VERIFICATION_TIMEOUT_MS,
  transactionId,
}: {
  fetcher?: FetchLike;
  secretKey: string;
  timeoutMs?: number;
  transactionId: string;
}): Promise<
  | { details: KlumpVerifiedTransactionDetails; success: true }
  | { error: string; status: number; success: false }
> {
  let response: Response;
  try {
    response = await fetcher(
      `${KLUMP_TRANSACTION_VERIFICATION_BASE_URL}/${encodeURIComponent(
        transactionId
      )}/verify`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'klump-secret-key': secretKey,
        },
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
  } catch {
    return {
      error: 'Klump transaction verification failed',
      status: 502,
      success: false,
    };
  }

  if (!response.ok) {
    return {
      error: 'Klump transaction verification failed',
      status: 502,
      success: false,
    };
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    return {
      error: 'Invalid Klump transaction verification response',
      status: 502,
      success: false,
    };
  }

  const parsedDetails = parseKlumpVerifiedTransactionResponse(responseBody);
  if (!parsedDetails) {
    return {
      error: 'Invalid Klump transaction verification response',
      status: 502,
      success: false,
    };
  }

  if (parsedDetails.isLive === false) {
    return {
      error: 'Sandbox Klump transaction not accepted',
      status: 400,
      success: false,
    };
  }

  return { details: parsedDetails, success: true };
}

export async function verifyKlumpWebhookTransaction({
  details,
  fetcher,
  reference,
  secretKey,
  transaction,
}: {
  details: KlumpWebhookDetails;
  fetcher?: FetchLike;
  reference: string;
  secretKey: string;
  transaction: KlumpTransactionRecord;
}): Promise<
  { success: true } | { error: string; status: number; success: false }
> {
  const verification = await verifyKlumpTransactionWithProvider({
    fetcher,
    secretKey,
    transactionId: details.transactionId,
  });

  if (!verification.success) {
    return verification;
  }

  if (verification.details.transactionId !== details.transactionId) {
    return {
      error: 'Klump transaction id mismatch',
      status: 400,
      success: false,
    };
  }

  if (
    verification.details.merchantReference &&
    verification.details.merchantReference !== reference
  ) {
    return {
      error: 'Klump transaction reference mismatch',
      status: 400,
      success: false,
    };
  }

  if (!amountsMatch(transaction.amount, verification.details.amount)) {
    return {
      error: 'Verified payment amount mismatch',
      status: 400,
      success: false,
    };
  }

  if (!currenciesMatch(transaction.currency, verification.details.currency)) {
    return {
      error: 'Verified payment currency mismatch',
      status: 400,
      success: false,
    };
  }

  return { success: true };
}
