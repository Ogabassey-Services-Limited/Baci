import { z } from 'zod';
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
  requeryResponseBodySchema,
  validateCustomerRequestSchema,
  validateCustomerResponseBodySchema,
  vendRequestSchema,
  vendResponseBodySchema,
} from '@/schemas/monnify-bills-schema';

const MONNIFY_SUCCESS_RESPONSE_CODE = '0';
const MONNIFY_SUCCESS_STATUSES = new Set(['PAID', 'SUCCESS', 'SUCCESSFUL']);
const MONNIFY_PROCESSING_STATUSES = new Set([
  'PENDING',
  'IN_PROGRESS',
  'PROCESSING',
]);
const MONNIFY_FAILED_STATUSES = new Set(['FAILED', 'FAILURE', 'UNSUCCESSFUL']);

export class MonnifyTransientVendError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, MonnifyTransientVendError.prototype);
    this.name = 'MonnifyTransientVendError';
  }
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
  return status?.trim().toUpperCase();
}

// Helper for making authenticated requests to Monnify VAS APIs with a timeout
async function monnifyRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getMonnifyToken();
  const baseUrl = getMonnifyBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      controller.abort();
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error(
          `Monnify server error: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        `Monnify API error: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Monnify request timed out or aborted');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getBillerCategories(): Promise<BillerCategory[]> {
  const envelope = await monnifyRequest(
    '/api/v1/vas/bills-payment/biller-categories',
    { method: 'GET' }
  );
  const parsed = monnifyEnvelopeSchema(z.array(billerCategorySchema)).parse(
    envelope
  );
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller categories lookup');
  return parsed.responseBody ?? [];
}

export async function getBillers(categoryCode: string): Promise<Biller[]> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/billers?categoryCode=${encodeURIComponent(categoryCode)}`,
    { method: 'GET' }
  );
  const parsed = monnifyEnvelopeSchema(z.array(billerSchema)).parse(envelope);
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller lookup');
  return parsed.responseBody ?? [];
}

export async function getBillerProducts(
  billerCode: string
): Promise<BillerProduct[]> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/biller-products?billerCode=${encodeURIComponent(billerCode)}`,
    { method: 'GET' }
  );
  const parsed = monnifyEnvelopeSchema(z.array(billerProductSchema)).parse(
    envelope
  );
  assertMonnifyBusinessSuccess(parsed, 'Monnify biller products lookup');
  return parsed.responseBody ?? [];
}

export async function verifyBillCustomer(
  billerCode: string,
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
      billerCode,
      productCode,
      customerId: customerIdentifier,
    });

    const envelope = await monnifyRequest(
      '/api/v1/vas/bills-payment/validate-customer',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
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
      message: error instanceof Error ? error.message : 'Verification failed',
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
      vendAmount: amount,
      customerId: customerIdentifier,
      vendReference: requestReference,
      validationReference,
    });

    const envelope = await monnifyRequest('/api/v1/vas/bills-payment/vend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

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

    const statusVal = normalizeMonnifyStatus(body.status || body.vendStatus);
    const transactionReference = body.transactionReference || undefined;

    const isSuccess = !!statusVal && MONNIFY_SUCCESS_STATUSES.has(statusVal);
    const isProcessing =
      !!statusVal && MONNIFY_PROCESSING_STATUSES.has(statusVal);
    const isFailed = !!statusVal && MONNIFY_FAILED_STATUSES.has(statusVal);

    if ((isSuccess || isProcessing) && !transactionReference) {
      throw new MonnifyTransientVendError(
        'Monnify vend response missing transactionReference'
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
      transactionId: transactionReference,
      pin: body?.token || undefined,
      message:
        parsedEnvelope.responseMessage ||
        (isFailed ? 'Vend request failed' : 'Vend request completed'),
      status,
      amount,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Explicit client HTTP 4xx errors are terminal business failures
    if (errorMsg.includes('Monnify API error: 4')) {
      return {
        success: false,
        reference: requestReference,
        message: errorMsg,
        status: 'failed',
        amount,
      };
    }

    if (error instanceof MonnifyTransientVendError) {
      throw error;
    }

    throw new MonnifyTransientVendError(`Transient vend outcome: ${errorMsg}`);
  }
}

export async function checkTransactionStatus(
  transactionReference: string
): Promise<{ status: string; message: string; pin?: string }> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/requery?transactionReference=${encodeURIComponent(transactionReference)}`,
    { method: 'GET' }
  );

  const parsed = monnifyEnvelopeSchema(requeryResponseBodySchema).parse(
    envelope
  );

  if (isMonnifyBusinessSuccess(parsed) && parsed.responseBody) {
    const body = parsed.responseBody;
    const statusVal = normalizeMonnifyStatus(body.status || body.vendStatus);

    if (statusVal && MONNIFY_SUCCESS_STATUSES.has(statusVal)) {
      return {
        status: 'successful',
        message: parsed.responseMessage || 'success',
        pin: body.token || undefined,
      };
    }
    if (statusVal && MONNIFY_PROCESSING_STATUSES.has(statusVal)) {
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
