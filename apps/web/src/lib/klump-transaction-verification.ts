import {
  asRecord,
  type JsonRecord,
  readBoolean,
  readNonNegativeNumber,
  readString,
} from '@/lib/klump-parse-helpers';
import type { KlumpWebhookDetails } from '@/lib/klump-webhook';
import { amountsMatch, currenciesMatch } from '@/lib/klump-webhook';

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
  merchant_amount?: number | string | null;
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

export function getKlumpExpectedPaymentAmount(
  transaction: Pick<KlumpTransactionRecord, 'amount' | 'merchant_amount'>
) {
  const merchantAmount = transaction.merchant_amount;
  const parsedMerchantAmount = Number(merchantAmount);
  if (
    merchantAmount != null &&
    !(typeof merchantAmount === 'string' && merchantAmount.trim() === '') &&
    Number.isFinite(parsedMerchantAmount) &&
    parsedMerchantAmount >= 0
  ) {
    return merchantAmount;
  }

  return transaction.amount;
}

function isSuccessfulKlumpVerification(sources: readonly JsonRecord[]) {
  const explicitSuccess = readBoolean(sources, [
    'is_successful',
    'isSuccessful',
  ]);
  if (explicitSuccess === true) {
    return true;
  }

  const status = readString(sources, [
    'status',
    'payment_status',
    'transaction_status',
  ]);
  if (KLUMP_SUCCESS_STATUSES.has(status?.toLowerCase() ?? '')) {
    return true;
  }

  return false;
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

  if (!isSuccessfulKlumpVerification(sources)) {
    return null;
  }

  const transactionId = readString(sources, [
    'id',
    'transaction_id',
    'transactionId',
    'checkout_transaction_id',
    'checkoutTransactionId',
  ]);
  const amount =
    readNonNegativeNumber(sources, ['original_amount', 'originalAmount']) ??
    readNonNegativeNumber(sources, ['amount', 'total_amount', 'totalAmount']);

  if (!(transactionId && amount != null)) {
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

  if (
    !amountsMatch(
      getKlumpExpectedPaymentAmount(transaction),
      verification.details.amount
    )
  ) {
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
