import { createTimeoutComposedFetch } from '@/lib/supabase/compose-fetch-signal';
import { createStorefrontBuildReadFetch } from './storefront-build-read-fetch';

const RUNTIME_PUBLIC_READ_TIMEOUT_MS = 10_000;
const BUILD_PUBLIC_READ_TIMEOUT_MS = 30_000;

/** Builds the shared anonymous-read transport for cached and prerendered storefront data. */
export function createStorefrontPublicReadFetch(timeoutMs?: number) {
  const isBoundedBuild = process.env.BACI_STOREFRONT_BUILD_READS === 'bounded';
  const effectiveTimeoutMs =
    timeoutMs ??
    (isBoundedBuild
      ? BUILD_PUBLIC_READ_TIMEOUT_MS
      : RUNTIME_PUBLIC_READ_TIMEOUT_MS);
  const timedFetch = createTimeoutComposedFetch(effectiveTimeoutMs);

  return isBoundedBuild
    ? createStorefrontBuildReadFetch(timedFetch)
    : timedFetch;
}
