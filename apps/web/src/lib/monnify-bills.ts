import { z } from 'zod';
import { getMonnifyBaseUrl } from '@/env';
import type { PurchaseResult } from '@/lib/kuda';
import { getMonnifyToken } from '@/lib/monnify';
import {
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

export async function getBillerCategories(): Promise<unknown> {
  const envelope = await monnifyRequest(
    '/api/v1/vas/bills-payment/biller-categories',
    { method: 'GET' }
  );
  const parsed = monnifyEnvelopeSchema(z.array(billerCategorySchema)).parse(
    envelope
  );
  return parsed.responseBody ?? [];
}

export async function getBillers(categoryCode: string): Promise<unknown> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/billers?categoryCode=${encodeURIComponent(categoryCode)}`,
    { method: 'GET' }
  );
  const parsed = monnifyEnvelopeSchema(z.array(billerSchema)).parse(envelope);
  return parsed.responseBody ?? [];
}

export async function getBillerProducts(billerCode: string): Promise<unknown> {
  const envelope = await monnifyRequest(
    `/api/v1/vas/bills-payment/biller-products?billerCode=${encodeURIComponent(billerCode)}`,
    { method: 'GET' }
  );
  const parsed = monnifyEnvelopeSchema(z.array(billerProductSchema)).parse(
    envelope
  );
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

    if (parsed.requestSuccessful && parsed.responseBody) {
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
      message: parsed.responseMessage || 'Validation failed',
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

    if (!parsedEnvelope.requestSuccessful) {
      return {
        success: false,
        reference: requestReference,
        message: parsedEnvelope.responseMessage || 'Monnify business failure',
        status: 'failed',
        amount,
      };
    }

    const body = parsedEnvelope.responseBody;
    const statusVal = body?.status || body?.vendStatus;

    const isSuccess = !!(
      parsedEnvelope.requestSuccessful &&
      parsedEnvelope.responseCode === '0' &&
      body &&
      (statusVal === 'PAID' ||
        statusVal === 'SUCCESS' ||
        statusVal === 'SUCCESSFUL')
    );
    const isProcessing = !!(
      parsedEnvelope.requestSuccessful &&
      parsedEnvelope.responseCode === '0' &&
      body &&
      (statusVal === 'PENDING' ||
        statusVal === 'IN_PROGRESS' ||
        statusVal === 'PROCESSING')
    );

    const status = isSuccess
      ? 'successful'
      : isProcessing
        ? 'pending'
        : 'failed';

    return {
      success: isSuccess || isProcessing,
      reference: requestReference,
      transactionId: body?.transactionReference || undefined,
      pin: body?.token || undefined,
      message: parsedEnvelope.responseMessage || 'Vend request completed',
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
    // Network errors, timeouts, and 5xx errors are transient outcomes -> status remains pending
    return {
      success: true,
      reference: requestReference,
      status: 'pending',
      message: `Transient vend outcome: ${errorMsg}`,
      amount,
    };
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

  if (parsed.requestSuccessful && parsed.responseBody) {
    const body = parsed.responseBody;
    const statusVal = body.status || body.vendStatus;

    if (
      statusVal === 'PAID' ||
      statusVal === 'SUCCESS' ||
      statusVal === 'SUCCESSFUL'
    ) {
      return {
        status: 'successful',
        message: parsed.responseMessage || 'success',
        pin: body.token || undefined,
      };
    }
    if (
      statusVal === 'PENDING' ||
      statusVal === 'IN_PROGRESS' ||
      statusVal === 'PROCESSING'
    ) {
      return {
        status: 'processing',
        message: parsed.responseMessage || 'processing',
      };
    }
  }

  return {
    status: 'failed',
    message: parsed.responseMessage || 'failed',
  };
}
