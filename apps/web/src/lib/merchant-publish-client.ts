import { fetchWithCsrf } from '@/lib/api-client';

/**
 * Requests a publish-state toggle for an explicitly selected merchant.
 *
 * @param merchantId - The active merchant ID asserted by the caller.
 * @param isPublished - Current publish state. Published stores are unpublished
 * with DELETE; all other states publish with POST.
 * @returns The raw publish endpoint response for callers to inspect.
 */
export function requestMerchantPublish(
  merchantId: string,
  isPublished?: boolean | null
): Promise<Response> {
  return fetchWithCsrf('/api/merchant/publish', {
    method: isPublished ? 'DELETE' : 'POST',
    body: JSON.stringify({ merchantId }),
  });
}
