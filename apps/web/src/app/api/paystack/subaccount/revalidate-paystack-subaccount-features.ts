import { revalidateTag } from 'next/cache';

/**
 * Invalidates the same merchant feature tag as `revalidateFeatures` without
 * importing its Cloudflare credential-authority dependency graph.
 */
export function revalidatePaystackSubaccountFeatures(merchantId: string): void {
  revalidateTag(`features-${merchantId}`, 'merchant');
}
