import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getKlumpWebhookSecret as getConfiguredKlumpWebhookSecret } from '@/env';

export type JsonRecord = Record<string, unknown>;

export interface KlumpWebhookDetails {
  amount: number;
  currency: string | null;
  event: string | null;
  isLive: boolean | null;
  merchantReference: string;
  transactionId: string;
}

export type KlumpWebhookParseResult =
  | {
      details: KlumpWebhookDetails | null;
      payload: JsonRecord;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

const KlumpWebhookSchema = z
  .object({
    data: z.record(z.string(), z.unknown()).optional(),
    event: z.string().optional(),
  })
  .passthrough();

const KLUMP_SUCCESS_EVENTS = new Set([
  'klump.payment.success',
  'klump.payment.successful',
  'klump.payment.transaction.success',
  'klump.payment.transaction.successful',
  'payment.success',
  'payment.successful',
  'success',
  'successful',
  'transaction.success',
  'transaction.successful',
]);

const SHA256_HEX_SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

export function getKlumpWebhookSecret(env?: Partial<NodeJS.ProcessEnv>) {
  if (!env) {
    return getConfiguredKlumpWebhookSecret() ?? '';
  }

  const webhookSecret = env.KLUMP_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    return webhookSecret;
  }

  return env.KLUMP_SECRET_KEY?.trim() || '';
}

function normalizeSignature(signature: string | null) {
  if (!signature) {
    return null;
  }

  const trimmed = signature.trim();
  const [, prefixedSignature] = trimmed.match(/^sha256=(.+)$/i) ?? [];
  return (prefixedSignature || trimmed).toLowerCase();
}

export function verifyKlumpWebhookSignature({
  rawBody,
  secret,
  signature,
}: {
  rawBody: string;
  secret: string;
  signature: string | null;
}) {
  const normalizedSignature = normalizeSignature(signature);
  if (!(secret && normalizedSignature)) {
    return false;
  }

  if (!SHA256_HEX_SIGNATURE_PATTERN.test(normalizedSignature)) {
    return false;
  }

  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const provided = Buffer.from(normalizedSignature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');

    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  } catch {
    return false;
  }
}

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

function isSuccessfulKlumpEvent(payload: JsonRecord, sources: JsonRecord[]) {
  const event = readString([payload], ['event'])?.toLowerCase() ?? null;
  if (event) {
    return KLUMP_SUCCESS_EVENTS.has(event);
  }

  const status = readString(sources, [
    'status',
    'payment_status',
    'transaction_status',
  ]);

  return ['paid', 'success', 'successful', 'completed'].includes(
    status?.toLowerCase() ?? ''
  );
}

function extractKlumpDetails(payload: JsonRecord): KlumpWebhookDetails | null {
  const data = asRecord(payload.data);
  const transaction = asRecord(data.transaction);
  const sources = [transaction, data, payload];

  if (!isSuccessfulKlumpEvent(payload, sources)) {
    return null;
  }

  const merchantReference = readString(sources, [
    'merchant_reference',
    'merchantReference',
    'reference',
    'tx_ref',
    'txRef',
  ]);
  const transactionId = readString(sources, [
    'id',
    'transaction_id',
    'transactionId',
    'checkout_transaction_id',
    'checkoutTransactionId',
  ]);
  const amount = readNumber(sources, ['amount', 'total_amount', 'totalAmount']);

  if (!(merchantReference && transactionId && amount)) {
    return null;
  }

  return {
    amount,
    currency: readString(sources, ['currency']),
    event: readString([payload], ['event']),
    isLive: readBoolean(sources, ['is_live', 'isLive']),
    merchantReference,
    transactionId,
  };
}

export function parseKlumpWebhookPayload(
  rawBody: string
): KlumpWebhookParseResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return { error: 'Invalid JSON body', success: false };
  }

  const parsed = KlumpWebhookSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { error: 'Invalid payload structure', success: false };
  }

  const payload = parsed.data;
  const details = extractKlumpDetails(payload);
  const event = readString([payload], ['event']);
  if (event && KLUMP_SUCCESS_EVENTS.has(event.toLowerCase()) && !details) {
    return { error: 'Invalid Klump payment payload', success: false };
  }

  return { details, payload, success: true };
}

export function amountsMatch(
  expected: number | string | null,
  received: number
) {
  const expectedAmount = Number(expected);
  return (
    Number.isFinite(expectedAmount) &&
    Math.abs(expectedAmount - received) <= 0.01
  );
}

export function currenciesMatch(
  expected: string | null,
  received: string | null
) {
  if (!received) {
    return true;
  }

  return (expected || 'NGN').toUpperCase() === received.toUpperCase();
}

export function hasKlumpIdConflict(
  metadata: JsonRecord | null,
  transactionId: string
) {
  const existingId = metadata?.klump_transaction_id;
  return (
    typeof existingId === 'string' &&
    existingId.trim().length > 0 &&
    existingId !== transactionId
  );
}

export function getMergedKlumpMetadata({
  details,
  headers,
  metadata,
}: {
  details: KlumpWebhookDetails;
  headers: Headers;
  metadata: JsonRecord | null;
}) {
  return {
    ...(metadata ?? {}),
    klump_event: details.event,
    klump_is_live: details.isLive,
    klump_transaction_id: details.transactionId,
    klump_webhook_attempt: headers.get('x-klump-webhook-attempt'),
    klump_webhook_id: headers.get('x-klump-webhook-id'),
  };
}
