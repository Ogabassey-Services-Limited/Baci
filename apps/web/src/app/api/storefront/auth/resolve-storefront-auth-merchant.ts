import { getCurrentSlugForAlias } from '@/lib/slug-alias-cache';
import {
  isSlugShapedIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
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

async function resolveByIdentifier(
  supabase: StorefrontAuthMerchantRpcClient,
  identifier: string
): Promise<StorefrontAuthMerchant | null> {
  const { data, error } = await supabase.rpc(
    'resolve_storefront_auth_merchant',
    { p_identifier: identifier }
  );

  if (error) {
    throw new Error(
      `Failed to resolve storefront auth merchant: ${identifier}`,
      { cause: error }
    );
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  return parseStorefrontAuthMerchantRow(firstRow);
}

// Retired-slug fallback: storefront auth is initiated from the request BODY (OTP
// send/verify, session), which the proxy can't rewrite. A customer with an open tab
// on a just-renamed store keeps sending the retired slug, so resolve it to the
// current slug via the alias table and retry. (Only slugs alias; a custom domain
// identifier won't match an alias and returns null unchanged.)
async function resolveByAlias(
  supabase: StorefrontAuthMerchantRpcClient,
  normalizedIdentifier: string
): Promise<StorefrontAuthMerchant | null> {
  const currentSlug = await getCurrentSlugForAlias(normalizedIdentifier);
  if (currentSlug && currentSlug !== normalizedIdentifier) {
    return resolveByIdentifier(supabase, currentSlug);
  }
  return null;
}

export async function resolveStorefrontAuthMerchant(
  supabase: StorefrontAuthMerchantRpcClient,
  identifier: string
): Promise<StorefrontAuthMerchant | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!isValidMerchantIdentifier(normalizedIdentifier)) {
    // A slug-shaped but RESERVED identifier (e.g. a store that used 'staff' before
    // it was reserved, then renamed) never resolves as a live storefront — but an
    // in-flight auth request from a still-open tab on that retired subdomain must
    // still map to the current slug via the alias table. Run the alias fallback
    // before rejecting; domain-shaped / malformed identifiers still return null.
    if (isSlugShapedIdentifier(normalizedIdentifier)) {
      return resolveByAlias(supabase, normalizedIdentifier);
    }
    return null;
  }

  const resolved = await resolveByIdentifier(supabase, normalizedIdentifier);
  if (resolved) {
    return resolved;
  }

  return resolveByAlias(supabase, normalizedIdentifier);
}
