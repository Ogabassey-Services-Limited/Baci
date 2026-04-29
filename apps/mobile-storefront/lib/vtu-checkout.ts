import Constants from 'expo-constants';
import { z } from 'zod';
import { CONFIG } from '@/lib/config';
import { DEFAULT_TIMEOUT, fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { MOBILE_TO_KUDA_PROVIDER } from '@/lib/network-utils';
import { supabase } from '@/lib/supabase';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://usebaci.com';

const GatewayEnum = z.enum(['paystack', 'korapay']);

const InitCheckoutResponseSchema = z.object({
  success: z.literal(true),
  authorization_url: z.string().url(),
  checkout_url: z.string().url().optional(),
  gateway: GatewayEnum,
  reference: z.string(),
  vtu_reference: z.string(),
  vtu_transaction_id: z.string(),
});

const ConfirmCheckoutResponseSchema = z.object({
  success: z.boolean().optional(),
  status: z.enum(['successful', 'processing']),
  reference: z.string(),
  amount: z.number().optional(),
  customerIdentifier: z.string().optional(),
  voucherPin: z.string().optional(),
  cashback: z
    .object({
      amount: z.number(),
      credited: z.boolean(),
      newBalance: z.number(),
    })
    .optional(),
});

const SavedCardSchema = z.object({
  id: z.string(),
  provider: z.literal('paystack'),
  label: z.string(),
  brand: z.string().nullable(),
  bank: z.string().nullable(),
  last4: z.string().nullable(),
  exp_month: z.string().nullable(),
  exp_year: z.string().nullable(),
  is_default: z.boolean(),
});

const SavedCardsResponseSchema = z.object({
  cards: z.array(SavedCardSchema),
});

const ChargeSavedCardSuccessSchema = z.object({
  success: z.literal(true),
  status: z.literal('successful'),
  reference: z.string(),
  amount: z.number(),
  customerIdentifier: z.string().optional(),
  voucherPin: z.string().optional(),
  cashback: z
    .object({
      amount: z.number(),
      credited: z.boolean(),
      newBalance: z.number(),
    })
    .optional(),
});

const ChargeSavedCardGatewaySchema = z.object({
  success: z.literal(true),
  requires_authorization: z.literal(true),
  authorization_url: z.string().url(),
  gateway: z.literal('paystack'),
  reference: z.string(),
});

const ChargeSavedCardProcessingSchema = z.object({
  status: z.literal('processing'),
  reference: z.string(),
});

export type VTUPaymentGateway = z.infer<typeof GatewayEnum>;
export type VtuCheckoutConfirmation = z.infer<
  typeof ConfirmCheckoutResponseSchema
>;
export type SavedVtuCard = z.infer<typeof SavedCardSchema>;
export type SavedVtuCardChargeSuccess = z.infer<
  typeof ChargeSavedCardSuccessSchema
>;
export type SavedVtuCardChargeAuthorizationRequired = z.infer<
  typeof ChargeSavedCardGatewaySchema
>;
export type SavedVtuCardChargeProcessing = z.infer<
  typeof ChargeSavedCardProcessingSchema
>;
export type SavedVtuCardChargeResult =
  | SavedVtuCardChargeSuccess
  | SavedVtuCardChargeAuthorizationRequired
  | SavedVtuCardChargeProcessing;

export class VtuPaymentStillProcessingError extends Error {
  amount?: number;
  customerIdentifier?: string;
  reference: string;

  constructor({
    amount,
    customerIdentifier,
    reference,
  }: {
    amount?: number;
    customerIdentifier?: string;
    reference: string;
  }) {
    super('Payment is still processing. Check your utility history shortly.');
    this.name = 'VtuPaymentStillProcessingError';
    Object.setPrototypeOf(this, VtuPaymentStillProcessingError.prototype);
    this.amount = amount;
    this.customerIdentifier = customerIdentifier;
    this.reference = reference;
  }
}

export interface VTUCheckoutPayload {
  amount: number;
  billItemIdentifier?: string;
  billerName?: string;
  customerIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  dataPlanCode?: string;
  gateway: VTUPaymentGateway;
  networkProvider?: string;
  phoneNumber?: string;
  type: 'airtime' | 'data' | 'electricity' | 'cable_tv' | 'betting';
}

export function normalizeVtuCheckoutPayload<T extends object>(payload: T): T {
  if (!('networkProvider' in payload)) {
    return payload;
  }

  const rawProvider = (payload as { networkProvider?: unknown })
    .networkProvider;
  if (typeof rawProvider !== 'string' || !rawProvider) {
    return payload;
  }

  // MOBILE_TO_KUDA_PROVIDER keys are lowercase; lowercase the input so callers
  // can pass MTN/Mtn/mtn interchangeably without missing the mapping.
  const lookupKey = rawProvider.toLowerCase();
  return {
    ...payload,
    networkProvider: MOBILE_TO_KUDA_PROVIDER[lookupKey] ?? rawProvider,
  };
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
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication required. Please sign in again.');
  }

  return session.access_token;
}

async function parseJsonResponse(response: Response) {
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Request failed. Please try again.'
    );
  }

  return data;
}

export async function initializeVtuCheckout(payload: VTUCheckoutPayload) {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `${API_URL}/api/vtu/checkout/initialize`,
    {
      method: 'POST',
      timeout: DEFAULT_TIMEOUT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...normalizeVtuCheckoutPayload(payload),
        merchantSlug: CONFIG.MERCHANT_SLUG,
      }),
    }
  );

  const data = await parseJsonResponse(response);
  return InitCheckoutResponseSchema.parse(data);
}

export async function confirmVtuCheckout({
  gateway,
  reference,
}: {
  gateway: VTUPaymentGateway;
  reference: string;
}) {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `${API_URL}/api/vtu/checkout/confirm`,
    {
      method: 'POST',
      timeout: DEFAULT_TIMEOUT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gateway,
        merchantSlug: CONFIG.MERCHANT_SLUG,
        reference,
      }),
    }
  );

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const gatewayStatus =
      typeof data.status === 'string' ? data.status.toLowerCase() : '';
    if (
      response.status === 409 &&
      gatewayStatus !== 'failed' &&
      gatewayStatus !== 'abandoned'
    ) {
      return ConfirmCheckoutResponseSchema.parse({
        ...data,
        reference,
        status: 'processing' as const,
      });
    }

    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Request failed. Please try again.'
    );
  }

  const normalizedStatus =
    typeof data.status === 'string' ? data.status.toLowerCase() : '';

  if (normalizedStatus === 'already_completed') {
    return ConfirmCheckoutResponseSchema.parse({
      ...data,
      reference,
      status: 'processing' as const,
    });
  }

  return ConfirmCheckoutResponseSchema.parse(data);
}

export async function waitForVtuConfirmation({
  gateway,
  maxAttempts = 10,
  reference,
}: {
  gateway: VTUPaymentGateway;
  maxAttempts?: number;
  reference: string;
}) {
  let lastProcessingResult: VtuCheckoutConfirmation | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await confirmVtuCheckout({ gateway, reference });
    if (result.status === 'successful') {
      return result;
    }

    lastProcessingResult = result;
    await new Promise((resolve) => {
      setTimeout(resolve, 1200);
    });
  }

  throw new VtuPaymentStillProcessingError({
    amount: lastProcessingResult?.amount,
    customerIdentifier: lastProcessingResult?.customerIdentifier,
    reference: lastProcessingResult?.reference ?? reference,
  });
}

export function requiresSavedVtuCardAuthorization(
  result: SavedVtuCardChargeResult
): result is SavedVtuCardChargeAuthorizationRequired {
  return (
    'requires_authorization' in result && result.requires_authorization === true
  );
}

export function isSavedVtuCardChargeProcessing(
  result: SavedVtuCardChargeResult
): result is SavedVtuCardChargeProcessing {
  return 'status' in result && result.status === 'processing';
}

export async function listSavedVtuCards() {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `${API_URL}/api/vtu/checkout/saved-cards?merchantSlug=${encodeURIComponent(CONFIG.MERCHANT_SLUG)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: DEFAULT_TIMEOUT,
    }
  );

  const data = await parseJsonResponse(response);
  return SavedCardsResponseSchema.parse(data).cards;
}

export async function chargeSavedVtuCard(
  payload: Omit<VTUCheckoutPayload, 'gateway'> & {
    savedPaymentMethodId: string;
  }
): Promise<SavedVtuCardChargeResult> {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `${API_URL}/api/vtu/checkout/charge-saved-card`,
    {
      method: 'POST',
      timeout: DEFAULT_TIMEOUT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...normalizeVtuCheckoutPayload({
          ...payload,
          gateway: 'paystack',
        }),
        merchantSlug: CONFIG.MERCHANT_SLUG,
      }),
    }
  );

  const data = await parseJsonResponse(response);
  const immediateSuccess = ChargeSavedCardSuccessSchema.safeParse(data);
  if (immediateSuccess.success) {
    return immediateSuccess.data;
  }

  const gatewayChallenge = ChargeSavedCardGatewaySchema.safeParse(data);
  if (gatewayChallenge.success) {
    return gatewayChallenge.data;
  }

  return ChargeSavedCardProcessingSchema.parse(data);
}
