import { getMonnifyBaseUrl } from '@/env';
import type { PurchaseResult } from '@/lib/kuda';
import { getMonnifyToken } from '@/lib/monnify';
import {
  validateCustomerRequestSchema,
  vendRequestSchema,
} from '@/schemas/monnify-bills-schema';

interface MonnifyBaseResponse<T = unknown> {
  requestSuccessful: boolean;
  responseCode: string;
  responseMessage: string;
  responseBody: T;
}

interface ValidateCustomerResponseBody {
  customerName: string;
  validationReference: string;
}

interface VendResponseBody {
  transactionReference: string;
  paymentReference: string;
  status: string;
  token?: string;
}

interface RequeryResponseBody {
  transactionReference: string;
  paymentReference: string;
  status: string;
  token?: string;
}

// Helper for making authenticated requests to Monnify VAS APIs
async function monnifyRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getMonnifyToken();
  const baseUrl = getMonnifyBaseUrl();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Monnify API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getBillerCategories(): Promise<unknown> {
  return await monnifyRequest('/api/v1/vas/bills-payment/biller-categories', {
    method: 'GET',
  });
}

export async function getBillers(categoryCode: string): Promise<unknown> {
  return await monnifyRequest(
    `/api/v1/vas/bills-payment/billers?categoryCode=${encodeURIComponent(categoryCode)}`,
    {
      method: 'GET',
    }
  );
}

export async function getBillerProducts(billerCode: string): Promise<unknown> {
  return await monnifyRequest(
    `/api/v1/vas/bills-payment/biller-products?billerCode=${encodeURIComponent(billerCode)}`,
    {
      method: 'GET',
    }
  );
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
}> {
  try {
    const payload = validateCustomerRequestSchema.parse({
      billerCode,
      productCode,
      customerId: customerIdentifier,
    });

    const response = await monnifyRequest<
      MonnifyBaseResponse<ValidateCustomerResponseBody>
    >('/api/v1/vas/bills-payment/validate-customer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.requestSuccessful && response.responseBody) {
      return {
        verified: true,
        customerName: response.responseBody.customerName,
        validationReference: response.responseBody.validationReference,
        message: response.responseMessage || 'Validation successful',
      };
    }

    return {
      verified: false,
      message: response.responseMessage || 'Validation failed',
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

    const response = await monnifyRequest<
      MonnifyBaseResponse<VendResponseBody>
    >('/api/v1/vas/bills-payment/vend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const body = response.responseBody;
    const isSuccess = !!(
      response.requestSuccessful &&
      response.responseCode === '0' &&
      body &&
      (body.status === 'PAID' ||
        body.status === 'SUCCESS' ||
        body.status === 'SUCCESSFUL')
    );
    const isProcessing = !!(
      response.requestSuccessful &&
      response.responseCode === '0' &&
      body &&
      (body.status === 'PENDING' ||
        body.status === 'IN_PROGRESS' ||
        body.status === 'PROCESSING')
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
      message: response.responseMessage || 'Vend request completed',
      status,
      amount,
    };
  } catch (error) {
    return {
      success: false,
      reference: requestReference,
      message: error instanceof Error ? error.message : 'Purchase failed',
      status: 'failed',
      amount,
    };
  }
}

export async function checkTransactionStatus(
  paymentReference: string
): Promise<{ status: string; message: string; pin?: string }> {
  try {
    const response = await monnifyRequest<
      MonnifyBaseResponse<RequeryResponseBody>
    >(
      `/api/v1/vas/bills-payment/requery?paymentReference=${encodeURIComponent(paymentReference)}`,
      { method: 'GET' }
    );

    const body = response.responseBody;
    const requestSuccessful = response.requestSuccessful;

    if (requestSuccessful && body) {
      const state = body.status;
      if (state === 'PAID' || state === 'SUCCESS' || state === 'SUCCESSFUL') {
        return {
          status: 'successful',
          message: response.responseMessage || 'success',
          pin: body.token || undefined,
        };
      }
      if (
        state === 'PENDING' ||
        state === 'IN_PROGRESS' ||
        state === 'PROCESSING'
      ) {
        return {
          status: 'processing',
          message: response.responseMessage || 'processing',
        };
      }
    }

    return {
      status: 'failed',
      message: response.responseMessage || 'failed',
    };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Status query failed',
    };
  }
}
