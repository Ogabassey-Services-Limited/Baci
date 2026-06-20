export interface StorefrontAuthMerchant {
  business_name: string;
  custom_domain: string | null;
  id: string;
  is_published: boolean;
  slug: string;
}

interface StorefrontAuthMerchantRpcClient {
  rpc(
    functionName: 'resolve_storefront_auth_merchant',
    args: { p_identifier: string }
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

function parseStorefrontAuthMerchantRow(
  value: unknown
): StorefrontAuthMerchant | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.id !== 'string' ||
    typeof row.slug !== 'string' ||
    typeof row.business_name !== 'string' ||
    typeof row.is_published !== 'boolean'
  ) {
    return null;
  }

  return {
    business_name: row.business_name,
    custom_domain:
      typeof row.custom_domain === 'string' ? row.custom_domain : null,
    id: row.id,
    is_published: row.is_published,
    slug: row.slug,
  };
}

export async function resolveStorefrontAuthMerchant(
  supabase: StorefrontAuthMerchantRpcClient,
  identifier: string
): Promise<StorefrontAuthMerchant | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!normalizedIdentifier) {
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
