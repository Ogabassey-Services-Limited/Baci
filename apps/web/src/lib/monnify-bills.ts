import { cacheLife, cacheTag } from 'next/cache';
import { getMonnifyBaseUrl } from '@/env';
import type { PurchaseResult } from '@/lib/kuda';
import { getMonnifyToken } from '@/lib/monnify';
import {
  type Biller,
  type BillerCategory,
  type BillerProduct,
  billerCategorySchema,
  billerProductSchema,
  billerSchema,
  monnifyEnvelopeSchema,
  monnifyListResponseBodySchema,
  requeryResponseBodySchema,
  validateCustomerRequestSchema,
  validateCustomerResponseBodySchema,
  vendRequestSchema,
  vendResponseBodySchema,
} from '@/schemas/monnify-bills-schema';

const MONNIFY_SUCCESS_RESPONSE_CODE = '0';
const MONNIFY_DISCOVERY_TIMEOUT_MS = 10_000;
const MONNIFY_FINANCIAL_TIMEOUT_MS = 30_000;
const MONNIFY_DISCOVERY_CACHE_STALE_SECONDS = 60;
const MONNIFY_DISCOVERY_CACHE_REVALIDATE_SECONDS = 300;
const MONNIFY_DISCOVERY_CACHE_EXPIRE_SECONDS = 3600;
const MONNIFY_SUCCESS_STATUSES = new Set(['PAID', 'SUCCESS', 'SUCCESSFUL']);
const MONNIFY_PROCESSING_STATUSES = new Set([
  'PENDING',
  'IN_PROGRESS',
  'PROCESSING',
]);
const MONNIFY_FAILED_STATUSES = new Set(['FAILED', 'FAILURE', 'UNSUCCESSFUL']);
const SENSITIVE_DIGIT_SEQUENCE_PATTERN = /(?<!\d)\d{7,}(?!\d)/g;
const MONNIFY_ERROR_DETAIL_MAX_LENGTH = 240;
// 64 chars covers normal phone/account/reference lengths while keeping regex work bounded.
const MONNIFY_ERROR_DETAIL_REDACTION_LOOKAHEAD = 64;

class MonnifyHttpError extends Error {
  readonly detail: string | null;
  readonly status: number;
  readonly statusText: string;

  constructor({
    detail,
    prefix,
    status,
    statusText,
  }: {
    detail: string | null;
    prefix: string;
    status: number;
    statusText: string;
  }) {
    super(`${prefix}: ${status} ${statusText}`.trim());
    Object.setPrototypeOf(this, MonnifyHttpError.prototype);
    this.name = 'MonnifyHttpError';
    this.detail = detail;
    this.status = status;
    this.statusText = statusText;
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  get diagnosticMessage() {
    return this.detail ? `${this.message} - ${this.detail}` : this.message;
  }
}

export class MonnifyTransientVendError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, MonnifyTransientVendError.prototype);
    this.name = 'MonnifyTransientVendError';
  }
}

export function sanitizeMonnifyErrorDetail(value: string) {
  const redactionBound =
    MONNIFY_ERROR_DETAIL_MAX_LENGTH + MONNIFY_ERROR_DETAIL_REDACTION_LOOKAHEAD;
  let boundedValue = value.slice(0, redactionBound);

  if (
    boundedValue.length === redactionBound &&
    /\d$/.test(boundedValue) &&
    /^\d/.test(value.slice(redactionBound, redactionBound + 1))
  ) {
    boundedValue = boundedValue.replace(/\d+$/, '');
  }

  return boundedValue
    .replace(SENSITIVE_DIGIT_SEQUENCE_PATTERN, '[redacted]')
    .slice(0, MONNIFY_ERROR_DETAIL_MAX_LENGTH)
    .trim();
}

function getMonnifyErrorDetailFromBody(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const body = value as Record<string, unknown>;
  const candidates = [
    body.responseMessage,
    body.message,
    body.error,
    body.errorMessage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return sanitizeMonnifyErrorDetail(candidate);
    }
  }

  return null;
}

async function getMonnifyHttpErrorDetail(response: Response) {
  try {
    const responseText = await response.text();
    if (!responseText.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(responseText) as unknown;
      return (
        getMonnifyErrorDetailFromBody(parsed) ??
        sanitizeMonnifyErrorDetail(responseText)
      );
    } catch {
      return sanitizeMonnifyErrorDetail(responseText);
    }
  } catch {
    return null;
  }
}

async function createMonnifyHttpError(response: Response, prefix: string) {
  return new MonnifyHttpError({
    detail: await getMonnifyHttpErrorDetail(response),
    prefix,
    status: response.status,
    statusText: response.statusText,
  });
}

function getMonnifyEnvelopeMessage({
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

function isMonnifyBusinessSuccess(envelope: {
  requestSuccessful: boolean;
  responseCode: string;
}) {
  return (
    envelope.requestSuccessful &&
    envelope.responseCode === MONNIFY_SUCCESS_RESPONSE_CODE
  );
}

function assertMonnifyBusinessSuccess(
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

function normalizeMonnifyStatus(status: string | null | undefined) {
  const normalized = status?.trim().toUpperCase();
  return normalized || undefined;
}

/**
 * Classifies a Monnify bill outcome from a response body.
 *
 * Monnify bill responses carry TWO statuses: a payment-level `status` (was the
 * customer charged) and a delivery-level `vendStatus` (did the bill/token
 * actually get delivered). For token-bearing bills — prepaid electricity above
 * all — the token is produced by the vend completing, so `vendStatus` is the
 * authoritative outcome. The payment `status` can read SUCCESS while the token
 * is still being generated (`vendStatus` = IN_PROGRESS); reading `status` first
 * finalized such a bill as "successful" with no token and no later retry/notify.
 *
 * So: treat the bill as still processing whenever EITHER status is in progress,
 * and prefer `vendStatus` for the terminal outcome (falling back to `status`
 * when the response omits `vendStatus`, e.g. some airtime/data vends).
 */
function classifyMonnifyBillStatus(body: {
  status?: string | null;
  vendStatus?: string | null;
}) {
  const paymentStatus = normalizeMonnifyStatus(body.status);
  const vendStatus = normalizeMonnifyStatus(body.vendStatus);
  const isProcessing =
    (!!vendStatus && MONNIFY_PROCESSING_STATUSES.has(vendStatus)) ||
    (!!paymentStatus && MONNIFY_PROCESSING_STATUSES.has(paymentStatus));
  const terminalStatus = vendStatus ?? paymentStatus;
  const isSuccess =
    !isProcessing &&
    !!terminalStatus &&
    MONNIFY_SUCCESS_STATUSES.has(terminalStatus);
  const isFailed =
    !isProcessing &&
    !!terminalStatus &&
    MONNIFY_FAILED_STATUSES.has(terminalStatus);
  return { isSuccess, isProcessing, isFailed };
}

interface MonnifyRequestOptions extends RequestInit {
  timeoutMs?: number;
}

interface MonnifyDiscoveryOptions {
  signal?: AbortSignal;
}

// Helper for making authenticated requests to Monnify VAS APIs with a timeout
async function monnifyRequest<T = unknown>(
  endpoint: string,
  options: MonnifyRequestOptions = {}
): Promise<T> {
  const { timeoutMs = MONNIFY_DISCOVERY_TIMEOUT_MS, ...requestOptions } =
    options;
  const token = await getMonnifyToken();
  const baseUrl = getMonnifyBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const callerSignal = requestOptions.signal;
  const abortFromCaller = () => {
    controller.abort();
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      abortFromCaller();
    } else {
      callerSignal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(requestOptions.headers || {}),
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status >= 500) {
        throw await createMonnifyHttpError(response, 'Monnify server error');
      }
      throw await createMonnifyHttpError(response, 'Monnify API error');
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Monnify request timed out or aborted');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function getBillerCategories(
  options: MonnifyDiscoveryOptions = {}
): Promise<BillerCategory[]> {
  const envelope = await monnifyRequest(
    '/api/v1/vas/bills-payment/biller-categories',
    {
      method: 'GET',
      timeoutMs: MONNIFY_DISCOVERY_TIMEOUT_MS,
      signal: options.signal,
    }
  );
  const parsed = monnifyEnvelopeSchema(
    monnifyListResponseBodySchema(billerCategorySchema)
  ).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller categories lookup');
  return parsed.responseBody ?? [];
}

export async function getBillers(
  categoryCode: string,
  options: MonnifyDiscoveryOptions = {}
): Promise<Biller[]> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/billers?categoryCode=${encodeURIComponent(categoryCode)}`,
    {
      method: 'GET',
      timeoutMs: MONNIFY_DISCOVERY_TIMEOUT_MS,
      signal: options.signal,
    }
  );
  const parsed = monnifyEnvelopeSchema(
    monnifyListResponseBodySchema(billerSchema)
  ).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller lookup');
  return parsed.responseBody ?? [];
}

export async function getBillerProducts(
  billerCode: string,
  options: MonnifyDiscoveryOptions = {}
): Promise<BillerProduct[]> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/biller-products?biller_code=${encodeURIComponent(billerCode)}`,
    {
      method: 'GET',
      timeoutMs: MONNIFY_DISCOVERY_TIMEOUT_MS,
      signal: options.signal,
    }
  );
  const parsed = monnifyEnvelopeSchema(
    monnifyListResponseBodySchema(billerProductSchema)
  ).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller products lookup');
  return parsed.responseBody ?? [];
}

export async function getCachedBillers(categoryCode: string) {
  'use cache: remote';
  cacheLife({
    stale: MONNIFY_DISCOVERY_CACHE_STALE_SECONDS,
    revalidate: MONNIFY_DISCOVERY_CACHE_REVALIDATE_SECONDS,
    expire: MONNIFY_DISCOVERY_CACHE_EXPIRE_SECONDS,
  });
  cacheTag('monnify-discovery', `monnify-billers-${categoryCode}`);
  return await getBillers(categoryCode);
}

export async function getCachedBillerProducts(billerCode: string) {
  'use cache: remote';
  cacheLife({
    stale: MONNIFY_DISCOVERY_CACHE_STALE_SECONDS,
    revalidate: MONNIFY_DISCOVERY_CACHE_REVALIDATE_SECONDS,
    expire: MONNIFY_DISCOVERY_CACHE_EXPIRE_SECONDS,
  });
  cacheTag('monnify-discovery', `monnify-biller-products-${billerCode}`);
  return await getBillerProducts(billerCode);
}

// TEMP DIAGNOSTIC HELPER: returns the nested field-name paths of a Monnify
// envelope (values are intentionally omitted) so we can see whether the biller
// returns an address/units field that our Zod schema strips — without ever
// logging customer PII or prepaid meter tokens. Remove with the call sites once
// the address question is resolved.
function collectEnvelopeKeyPaths(
  value: unknown,
  prefix = '',
  out: string[] = [],
  depth = 0
): string[] {
  if (depth > 5 || value === null || typeof value !== 'object') {
    return out;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path);
    collectEnvelopeKeyPaths(
      (value as Record<string, unknown>)[key],
      path,
      out,
      depth + 1
    );
  }
  return out;
}

export async function verifyBillCustomer(
  _billerCode: string,
  productCode: string,
  customerIdentifier: string
): Promise<{
  verified: boolean;
  customerName?: string;
  message: string;
  validationReference?: string;
  requireValidationRef?: boolean;
}> {
  try {
    const payload = validateCustomerRequestSchema.parse({
      productCode,
      customerId: customerIdentifier,
    });

    const envelope = await monnifyRequest(
      '/api/v1/vas/bills-payment/validate-customer',
      {
        method: 'POST',
        timeoutMs: MONNIFY_FINANCIAL_TIMEOUT_MS,
        body: JSON.stringify(payload),
      }
    );

    // TEMP DIAGNOSTIC: log only the STRUCTURE (field-name paths) of the Monnify
    // validate-customer envelope — never the values — to reveal whether it carries
    // a customer-address field that our Zod schema strips. No PII/PINs are logged.
    // Remove once the address question is resolved.
    console.log(
      '[monnify-bills] validate-customer envelope keys:',
      JSON.stringify({ productCode, keys: collectEnvelopeKeyPaths(envelope) })
    );

    const parsed = monnifyEnvelopeSchema(
      validateCustomerResponseBodySchema
    ).parse(envelope);

    if (isMonnifyBusinessSuccess(parsed) && parsed.responseBody) {
      const body = parsed.responseBody;
      const validationReference =
        body.validationReference ||
        body.vendInstruction?.validationReference ||
        undefined;
      const requireValidationRef =
        body.requireValidationRef ??
        body.vendInstruction?.requireValidationRef ??
        false;

      return {
        verified: true,
        customerName: body.customerName || undefined,
        validationReference,
        requireValidationRef,
        message: parsed.responseMessage || 'Validation successful',
      };
    }

    return {
      verified: false,
      message: getMonnifyEnvelopeMessage({
        fallback: 'Validation failed',
        responseCode: parsed.responseCode,
        responseMessage: parsed.responseMessage,
      }),
    };
  } catch (error) {
    return {
      verified: false,
      message:
        error instanceof MonnifyHttpError
          ? 'Verification could not be completed with Monnify. Please check the details and try again.'
          : error instanceof Error
            ? error.message
            : 'Verification failed',
    };
  }
}

export async function purchaseBill(
  _billerCode: string,
  productCode: string,
  customerIdentifier: string,
  amount: number,
  _customerName: string,
  requestReference: string,
  _customerPhone?: string,
  validationReference?: string
): Promise<PurchaseResult> {
  try {
    const payload = vendRequestSchema.parse({
      productCode,
      // Monnify docs name this vendAmount, but the live VAS vend API rejects
      // airtime without amount. Send both with the same validated value.
      amount,
      vendAmount: amount,
      customerId: customerIdentifier,
      vendReference: requestReference,
      validationReference,
    });

    const envelope = await monnifyRequest('/api/v1/vas/bills-payment/vend', {
      method: 'POST',
      timeoutMs: MONNIFY_FINANCIAL_TIMEOUT_MS,
      body: JSON.stringify(payload),
    });

    // TEMP DIAGNOSTIC: log only the STRUCTURE (field-name paths) of the Monnify
    // vend envelope — never the values — to reveal whether the biller returns an
    // address/units field our schema strips. No tokens/PINs/PII are logged.
    // Remove once the address question is resolved.
    console.log(
      '[monnify-bills] vend envelope keys:',
      JSON.stringify({ productCode, keys: collectEnvelopeKeyPaths(envelope) })
    );

    const parsedEnvelope = monnifyEnvelopeSchema(vendResponseBodySchema).parse(
      envelope
    );

    if (!isMonnifyBusinessSuccess(parsedEnvelope)) {
      return {
        success: false,
        reference: requestReference,
        message: getMonnifyEnvelopeMessage({
          fallback: 'Monnify business failure',
          responseCode: parsedEnvelope.responseCode,
          responseMessage: parsedEnvelope.responseMessage,
        }),
        status: 'failed',
        amount,
      };
    }

    const body = parsedEnvelope.responseBody;
    if (!body) {
      throw new MonnifyTransientVendError(
        'Monnify vend response missing responseBody'
      );
    }

    const transactionReference = body.transactionReference || undefined;
    const vendReference = body.vendReference || undefined;

    const { isSuccess, isProcessing, isFailed } =
      classifyMonnifyBillStatus(body);

    // A successful vend delivers the token inline (metaData.token), so any
    // reference is enough to track it. A PENDING vend, however, must be
    // reconciled later via requery — and Monnify requery only resolves by
    // `vendReference` (not `transactionReference`). So a pending vend without a
    // vendReference is unreconcilable: treat it as transient so it retries
    // rather than persisting a `processing` row whose token can never be fetched.
    if (isSuccess && !transactionReference && !vendReference) {
      throw new MonnifyTransientVendError(
        'Monnify success vend response missing both transaction and vend references'
      );
    }
    if (isProcessing && !vendReference) {
      throw new MonnifyTransientVendError(
        'Monnify pending vend response missing a requeryable vend reference'
      );
    }

    const status = isSuccess
      ? 'successful'
      : isProcessing
        ? 'pending'
        : 'failed';

    return {
      success: isSuccess || isProcessing,
      reference: requestReference,
      transactionId: transactionReference ?? vendReference,
      // Monnify resolves requery by its own vendReference, not transactionRef.
      providerVendReference: vendReference,
      // Token lives at responseBody.metaData.token for prepaid electricity;
      // fall back to a flat token for billers that return it top-level.
      pin: body?.metaData?.token || body?.token || undefined,
      units: body?.metaData?.unit || undefined,
      message:
        parsedEnvelope.responseMessage ||
        (isFailed ? 'Vend request failed' : 'Vend request completed'),
      status,
      amount,
    };
  } catch (error) {
    if (error instanceof MonnifyHttpError && error.isClientError) {
      return {
        success: false,
        reference: requestReference,
        message:
          'Monnify rejected the bill payment request. Please verify the details and try again.',
        providerErrorDetail: error.diagnosticMessage,
        status: 'failed',
        amount,
      };
    }

    const errorMsg =
      error instanceof MonnifyHttpError
        ? error.diagnosticMessage
        : error instanceof Error
          ? error.message
          : String(error);

    if (error instanceof MonnifyTransientVendError) {
      throw error;
    }

    throw new MonnifyTransientVendError(`Transient vend outcome: ${errorMsg}`);
  }
}

export async function checkTransactionStatus(
  transactionReference: string
): Promise<{ status: string; message: string; pin?: string; units?: string }> {
  // Monnify's bills requery expects `reference`, not `transactionReference`
  // (the latter 400s with "Required request parameter 'reference' is not
  // present"). Note: the token is delivered inline in the vend response
  // (responseBody.metaData.token), so requery is only a fallback for
  // genuinely IN_PROGRESS vends.
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/requery?reference=${encodeURIComponent(transactionReference)}`,
    { method: 'GET', timeoutMs: MONNIFY_FINANCIAL_TIMEOUT_MS }
  );

  const parsed = monnifyEnvelopeSchema(requeryResponseBodySchema).parse(
    envelope
  );

  if (isMonnifyBusinessSuccess(parsed) && parsed.responseBody) {
    const body = parsed.responseBody;
    const { isSuccess, isProcessing } = classifyMonnifyBillStatus(body);

    if (isSuccess) {
      return {
        status: 'successful',
        message: parsed.responseMessage || 'success',
        pin: body.metaData?.token || body.token || undefined,
        units: body.metaData?.unit || undefined,
      };
    }
    if (isProcessing) {
      return {
        status: 'processing',
        message: parsed.responseMessage || 'processing',
      };
    }
  }

  return {
    status: 'failed',
    message: getMonnifyEnvelopeMessage({
      fallback: 'failed',
      responseCode: parsed.responseCode,
      responseMessage: parsed.responseMessage,
    }),
  };
}
