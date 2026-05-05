import { z } from 'zod';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { CONFIG } from '@/lib/config';
import { DEFAULT_TIMEOUT, fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { MOBILE_TO_KUDA_PROVIDER } from '@/lib/network-utils';
import { supabase } from '@/lib/supabase';

const API_URL = EXPO_PUBLIC_API_URL;
export const VTU_CHECKOUT_INITIALIZE_URL = `${API_URL}/api/vtu/checkout/initialize`;
export const VTU_CHECKOUT_WALLET_ONLY_URL = `${API_URL}/api/vtu/checkout/wallet-only`;

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

const ALLOWED_CONFIRM_CHECKOUT_STATUSES = ['successful', 'processing'] as const;

function isAllowedConfirmCheckoutStatus(
  status: string
): status is (typeof ALLOWED_CONFIRM_CHECKOUT_STATUSES)[number] {
  return ALLOWED_CONFIRM_CHECKOUT_STATUSES.some(
    (allowedStatus) => allowedStatus === status
  );
}

function normalizeConfirmCheckoutStatus(status: unknown) {
  if (typeof status !== 'string') {
    throw new Error(`Unexpected VTU checkout status: ${String(status)}`);
  }

  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'already_completed') {
    return 'processing' as const;
  }

  if (isAllowedConfirmCheckoutStatus(normalizedStatus)) {
    return normalizedStatus;
  }

  throw new Error(`Unexpected VTU checkout status: ${status}`);
}

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
  gateway: GatewayEnum.optional(),
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
  /**
   * Wallet credit applied to this purchase. Optional, non-negative.
   * - undefined / 0 → card-only (gateway charges full amount).
   * - 0 < walletAmount < amount → hybrid (gateway charges residual,
   *   wallet covers the rest in `fulfillPendingVtuTransaction`).
   * - walletAmount === amount → MUST go through `chargeWalletForVtu()`
   *   (the wallet-only route); the initialize / charge-saved-card
   *   routes reject this with a 400 redirecting the client.
   */
  walletAmount?: number;
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

function getResponseErrorMessage(data: Record<string, unknown>) {
  return typeof data.error === 'string'
    ? data.error
    : 'Request failed. Please try again.';
}

async function parseJsonResponse(response: Response) {
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(getResponseErrorMessage(data));
  }

  return data;
}

/**
 * Strip walletAmount from the request body unless it's a positive
 * number. The web schema treats `walletAmount: 0` as "card-only"
 * already, but sending an explicit `0` adds noise to the JSON. Same
 * guard pattern as `services/orders.ts` for the orders flow.
 */
function buildVtuRequestBody<T extends VTUCheckoutPayload>(payload: T) {
  const normalized = normalizeVtuCheckoutPayload(payload);
  const { walletAmount, ...rest } = normalized;
  return {
    ...rest,
    merchantSlug: CONFIG.MERCHANT_SLUG,
    ...(typeof walletAmount === 'number' && walletAmount > 0
      ? { walletAmount }
      : {}),
  };
}

export async function initializeVtuCheckout(payload: VTUCheckoutPayload) {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(VTU_CHECKOUT_INITIALIZE_URL, {
    method: 'POST',
    timeout: DEFAULT_TIMEOUT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildVtuRequestBody(payload)),
  });

  const data = await parseJsonResponse(response);
  return InitCheckoutResponseSchema.parse(data);
}

const WalletOnlyVtuResponseSchema = z.object({
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

export type WalletOnlyVtuResult = z.infer<typeof WalletOnlyVtuResponseSchema>;

/**
 * Wallet-only VTU purchase. Caller must guarantee the wallet balance
 * covers the full bill amount (`walletAmount === amount`); the route
 * rejects partial coverage with a 400.
 *
 * `idempotencyKey` is **caller-supplied** and MUST be reused for any
 * user-initiated retry of the same purchase intent (e.g. after a
 * network failure leaves the response in doubt). Generating a fresh
 * key per attempt would defeat the route's idempotency table — the
 * server can't tell two same-customer submits apart, debits the
 * wallet twice, and vends twice. The form controllers hold the key
 * in a ref and only rotate it once a definitive HTTP response (200
 * or 4xx) lands.
 */
export async function chargeWalletForVtu(
  payload: Omit<VTUCheckoutPayload, 'gateway'> & {
    walletAmount: number;
    idempotencyKey: string;
  }
) {
  const accessToken = await getAccessToken();
  const { idempotencyKey, ...rest } = payload;
  const normalized = normalizeVtuCheckoutPayload(rest);
  const response = await fetchWithTimeout(VTU_CHECKOUT_WALLET_ONLY_URL, {
    method: 'POST',
    timeout: DEFAULT_TIMEOUT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...normalized,
      merchantSlug: CONFIG.MERCHANT_SLUG,
    }),
  });

  const data = await parseJsonResponse(response);
  return WalletOnlyVtuResponseSchema.parse({
    ...data,
    status: normalizeConfirmCheckoutStatus(data.status),
  });
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

    throw new Error(getResponseErrorMessage(data));
  }

  return ConfirmCheckoutResponseSchema.parse({
    ...data,
    status: normalizeConfirmCheckoutStatus(data.status),
  });
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
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1200);
      });
    }
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
      body: JSON.stringify(
        buildVtuRequestBody({
          ...payload,
          gateway: 'paystack',
        })
      ),
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
