import { isValidMerchantIdentifier } from '@/lib/validation';
import {
  type StorefrontAuthMerchant,
  storefrontAuthMerchantRpcRowSchema,
} from '@/schemas/storefront-auth-merchant';

export type { StorefrontAuthMerchant } from '@/schemas/storefront-auth-merchant';

interface StorefrontAuthMerchantRpcClient {
  rpc(
    functionName: 'resolve_storefront_auth_merchant',
    args: { p_identifier: string }
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

function parseStorefrontAuthMerchantRow(
  value: unknown
): StorefrontAuthMerchant | null {
  const parsed = storefrontAuthMerchantRpcRowSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function resolveStorefrontAuthMerchant(
  supabase: StorefrontAuthMerchantRpcClient,
  identifier: string
): Promise<StorefrontAuthMerchant | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!isValidMerchantIdentifier(normalizedIdentifier)) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    'resolve_storefront_auth_merchant',
    { p_identifier: normalizedIdentifier }
  );

  if (error) {
    throw new Error(
      `Failed to resolve storefront auth merchant: ${normalizedIdentifier}`,
      { cause: error }
    );
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  return parseStorefrontAuthMerchantRow(firstRow);
}
