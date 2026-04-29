import {
  type CachedMerchant,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
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
  request,
  rootDomain,
  notFoundError,
  lookupError,
}: {
  request: Request;
  rootDomain: string;
  notFoundError: string;
  lookupError: string;
}): Promise<StorefrontMerchantResolveResult> {
  const routeIdentifiers = resolveStorefrontRouteIdentifiers({
    request,
    rootDomain,
  });

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
      const merchant = await getMerchantByIdentifier(routeIdentifier);

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
