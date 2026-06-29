/**
 * Build the storefront web URL for an order's insurance policy page. Mobile has
 * no embedded MyCover SDK, so when a claim is warranted but no hosted claim link
 * was captured, we route the customer to the web policy page — which hosts the
 * public-key SDK claim modal — instead of silently hiding the action.
 *
 * Returns null when the inputs can't form a safe http(s) URL.
 */
export function buildWebInsuranceClaimUrl(
  baseUrl: string | null | undefined,
  merchantSlug: string | null | undefined,
  orderId: string | null | undefined
): string | null {
  const slug = merchantSlug?.trim();
  const id = orderId?.trim();
  if (!(baseUrl && slug && id)) return null;

  try {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') {
      return null;
    }
    const path = `/${encodeURIComponent(slug)}/account/orders/${encodeURIComponent(id)}/insurance`;
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}
