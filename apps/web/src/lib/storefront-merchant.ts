import type { CachedMerchant } from '@/lib/cached-data';
import { getMerchantByIdentifierOrAlias } from '@/lib/get-merchant-by-identifier-or-alias';
import { resolveStorefrontRouteIdentifiers } from '@/lib/storefront-host';
import { RouteIdentifierSchema } from '@/schemas/route-identifier';

type StorefrontMerchantResolveSuccess = {
  success: true;
  identifier: string;
  merchant: CachedMerchant;
};

type StorefrontMerchantResolveFailure = {
  success: false;
  error: string;
  status: 400 | 404 | 500;
  cause?: unknown;
};

export type StorefrontMerchantResolveResult =
  | StorefrontMerchantResolveSuccess
  | StorefrontMerchantResolveFailure;

export async function resolveStorefrontMerchantFromRequest({
  fallbackIdentifier,
  request,
  rootDomain,
  notFoundError,
  lookupError,
}: {
  fallbackIdentifier?: string | null;
  request: Request;
  rootDomain: string;
  notFoundError: string;
  lookupError: string;
}): Promise<StorefrontMerchantResolveResult> {
  const hostIdentifiers = resolveStorefrontRouteIdentifiers({
    request,
    rootDomain,
  });
  const routeIdentifiers =
    hostIdentifiers.length > 0
      ? hostIdentifiers
      : fallbackIdentifier
        ? [fallbackIdentifier]
        : [];

  if (routeIdentifiers.length === 0) {
    return {
      success: false,
      status: 404,
      error: notFoundError,
    };
  }

  const parsedRouteIdentifiers: string[] = [];
  for (const routeIdentifier of routeIdentifiers) {
    const parsedRouteIdentifier =
      RouteIdentifierSchema.safeParse(routeIdentifier);

    if (!parsedRouteIdentifier.success) {
      return {
        success: false,
        status: 400,
        error: 'Invalid storefront host',
      };
    }

    parsedRouteIdentifiers.push(parsedRouteIdentifier.data);
  }

  let lastLookupError: unknown;
  for (const routeIdentifier of parsedRouteIdentifiers) {
    try {
      const merchant = await getMerchantByIdentifierOrAlias(routeIdentifier);

      if (merchant) {
        return {
          success: true,
          identifier: routeIdentifier,
          merchant,
        };
      }
    } catch (error) {
      lastLookupError = error;
    }
  }

  if (lastLookupError) {
    return {
      success: false,
      status: 500,
      error: lookupError,
      cause: lastLookupError,
    };
  }

  return {
    success: false,
    status: 404,
    error: notFoundError,
  };
}
