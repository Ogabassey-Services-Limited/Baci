import { z } from 'zod';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { CONFIG } from '@/lib/config';
import { DEFAULT_TIMEOUT, fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { supabase } from '@/lib/supabase';

const API_URL = EXPO_PUBLIC_API_URL;

const WalletTopUpGatewaySchema = z.enum(['paystack', 'korapay']);

const WalletTopUpInitializeResponseSchema = z.object({
  authorization_url: z.string().url(),
  checkout_url: z.string().url().optional(),
  gateway: WalletTopUpGatewaySchema,
  reference: z.string(),
  success: z.literal(true),
});

const WalletTopUpConfirmResponseSchema = z.object({
  amount: z.number().optional(),
  reference: z.string(),
  status: z.enum(['successful', 'processing']),
  success: z.boolean().optional(),
  wallet: z
    .object({
      balance: z.number(),
    })
    .optional(),
});

export type WalletTopUpGateway = z.infer<typeof WalletTopUpGatewaySchema>;
export type WalletTopUpInitializeResponse = z.infer<
  typeof WalletTopUpInitializeResponseSchema
>;
export type WalletTopUpConfirmation = z.infer<
  typeof WalletTopUpConfirmResponseSchema
>;

export class WalletTopUpStillProcessingError extends Error {
  reference: string;

  constructor(reference: string) {
    super('Wallet top-up is still processing. Check your wallet shortly.');
    this.name = 'WalletTopUpStillProcessingError';
    Object.setPrototypeOf(this, WalletTopUpStillProcessingError.prototype);
    this.reference = reference;
  }
}

async function getAccessToken() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Authentication required. Please sign in again.');
  }

  return session.access_token;
}

function getResponseErrorMessage(data: Record<string, unknown>) {
  return typeof data.error === 'string'
    ? data.error
    : 'Request failed. Please try again.';
}

function getOptionalString(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function getMerchantSlug(value?: string | null) {
  return getOptionalString(value) ?? getOptionalString(CONFIG.MERCHANT_SLUG);
}

async function parseJsonResponse(response: Response) {
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid server response (${response.status} ${response.statusText || 'Unknown status'}): ${
        error instanceof Error ? error.message : 'Unable to parse response'
      }`
    );
  }

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(data));
  }

  return data;
}

export async function initializeWalletTopUp({
  amount,
  customerName,
  customerPhone,
  gateway,
  merchantId,
  merchantSlug,
}: {
  amount: number;
  customerName?: string;
  customerPhone?: string | null;
  gateway?: WalletTopUpGateway;
  merchantId?: string | null;
  merchantSlug?: string | null;
}): Promise<WalletTopUpInitializeResponse> {
  const accessToken = await getAccessToken();
  const requestBody = {
    amount,
    customerName: getOptionalString(customerName),
    customerPhone: getOptionalString(customerPhone),
    gateway,
    merchantId: getOptionalString(merchantId),
    merchantSlug: getMerchantSlug(merchantSlug),
  };
  const response = await fetchWithTimeout(
    `${API_URL}/api/storefront/customer/wallet/top-up/initialize`,
    {
      body: JSON.stringify(requestBody),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      timeout: DEFAULT_TIMEOUT,
    }
  );

  const data = await parseJsonResponse(response);
  return WalletTopUpInitializeResponseSchema.parse(data);
}

export async function confirmWalletTopUp({
  gateway,
  merchantId,
  merchantSlug,
  reference,
}: {
  gateway: WalletTopUpGateway;
  merchantId?: string | null;
  merchantSlug?: string | null;
  reference: string;
}): Promise<WalletTopUpConfirmation> {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `${API_URL}/api/storefront/customer/wallet/top-up/confirm`,
    {
      body: JSON.stringify({
        gateway,
        merchantId: getOptionalString(merchantId),
        merchantSlug: getMerchantSlug(merchantSlug),
        reference,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      timeout: DEFAULT_TIMEOUT,
    }
  );

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid server response (${response.status} ${response.statusText || 'Unknown status'}): ${
        error instanceof Error ? error.message : 'Unable to parse response'
      }`
    );
  }

  if (!response.ok) {
    if (response.status === 409) {
      return WalletTopUpConfirmResponseSchema.parse({
        ...data,
        reference,
        status: 'processing' as const,
      });
    }
    throw new Error(getResponseErrorMessage(data));
  }

  return WalletTopUpConfirmResponseSchema.parse(data);
}

export async function waitForWalletTopUpConfirmation({
  gateway,
  merchantId,
  merchantSlug,
  maxAttempts = 10,
  reference,
}: {
  gateway: WalletTopUpGateway;
  merchantId?: string | null;
  merchantSlug?: string | null;
  maxAttempts?: number;
  reference: string;
}): Promise<WalletTopUpConfirmation> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await confirmWalletTopUp({
      gateway,
      merchantId,
      merchantSlug,
      reference,
    });
    if (result.status === 'successful') {
      return result;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1200);
      });
    }
  }

  throw new WalletTopUpStillProcessingError(reference);
}
