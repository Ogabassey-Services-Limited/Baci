import type { ZodType, z } from 'zod';
import { createStorefrontCustomerApiClient } from '@/lib/storefront-customer-api-client';
import {
  walletOrderFundingIntentCreateResponseSchema,
  walletOrderFundingIntentPollResponseSchema,
  type walletOrderFundingIntentSchema,
} from '@/schemas/order-wallet-funding-intent';

type WalletOrderFundingApiClient = ReturnType<
  typeof createStorefrontCustomerApiClient
>;

export type WalletOrderFundingIntent = z.infer<
  typeof walletOrderFundingIntentSchema
>;

export type WalletOrderFundingIntentCreateResponse = z.infer<
  typeof walletOrderFundingIntentCreateResponseSchema
>;

export class WalletFundingIntentValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: z.ZodError
  ) {
    super(message);
    this.name = 'WalletFundingIntentValidationError';
  }
}

function parseResponse<T>(schema: ZodType<T>, data: unknown, context: string) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new WalletFundingIntentValidationError(
      `Invalid wallet order funding intent ${context} response: ${parsed.error.message}`,
      parsed.error
    );
  }
  return parsed.data;
}

function parseCreateResponse(data: unknown) {
  return parseResponse(
    walletOrderFundingIntentCreateResponseSchema,
    data,
    'create'
  );
}

function parsePollResponse(data: unknown) {
  return parseResponse(
    walletOrderFundingIntentPollResponseSchema,
    data,
    'poll'
  );
}

function getWalletOrderFundingApiClient(client?: WalletOrderFundingApiClient) {
  return client ?? createStorefrontCustomerApiClient();
}

export async function createOrderWalletFundingIntent({
  client,
  consent,
  merchantId,
  merchantSlug,
  orderId,
}: {
  client?: WalletOrderFundingApiClient;
  consent?: boolean;
  merchantId?: string | null;
  merchantSlug?: string | null;
  orderId: string;
}) {
  const apiClient = getWalletOrderFundingApiClient(client);
  const identifiers = apiClient.buildMerchantIdentifiers({
    merchantId,
    merchantSlug,
  });
  const data = await apiClient.fetchJson({
    body: {
      ...(consent ? { consent: true } : {}),
      ...identifiers,
      orderId,
    },
    method: 'POST',
    path: '/api/storefront/customer/wallet/order-funding-intents',
  });

  return parseCreateResponse(data);
}

export async function getOrderWalletFundingIntent({
  client,
  intentId,
  merchantId,
  merchantSlug,
}: {
  client?: WalletOrderFundingApiClient;
  intentId: string;
  merchantId?: string | null;
  merchantSlug?: string | null;
}) {
  const apiClient = getWalletOrderFundingApiClient(client);
  const query = apiClient.buildMerchantIdentifiers({
    merchantId,
    merchantSlug,
  });
  const data = await apiClient.fetchJson({
    path: `/api/storefront/customer/wallet/order-funding-intents/${intentId}`,
    query,
  });

  return parsePollResponse(data);
}
