import { fetchWithCsrf } from '@/lib/api-client';
import type { PublishProduct } from '@/schemas/jumia/publish-products';
import { buildJumiaPublishPayload } from './publish-products-payload';

const PUBLISH_CONCURRENCY = 3;

export type JumiaPublishSubmissionResult = {
  ok: boolean;
  body: Record<string, unknown>;
};

export async function submitJumiaProducts(args: {
  products: PublishProduct[];
  integrationId: string;
  categoryCode: number;
  brand: { code: number; name: string };
  marketplaceCurrency: string;
}): Promise<JumiaPublishSubmissionResult[]> {
  const submitProduct = async (
    product: PublishProduct
  ): Promise<JumiaPublishSubmissionResult> => {
    const response = await fetchWithCsrf(
      '/api/marketplace/jumia/products/export',
      {
        method: 'POST',
        body: JSON.stringify(
          buildJumiaPublishPayload(
            product,
            args.integrationId,
            args.categoryCode,
            args.brand,
            args.marketplaceCurrency
          )
        ),
      }
    );
    const rawBody: unknown = await response.json().catch(() => ({}));
    const body: Record<string, unknown> =
      typeof rawBody === 'object' && rawBody !== null
        ? (rawBody as Record<string, unknown>)
        : {};
    return {
      ok: response.ok && (response.status ?? 200) < 207,
      body,
    };
  };

  const results: JumiaPublishSubmissionResult[] = [];
  for (
    let index = 0;
    index < args.products.length;
    index += PUBLISH_CONCURRENCY
  ) {
    const batch = args.products.slice(index, index + PUBLISH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (product) => {
        try {
          return await submitProduct(product);
        } catch {
          return {
            ok: false,
            body: { error: 'Failed to submit product to Jumia' },
          };
        }
      })
    );
    results.push(...batchResults);
  }
  return results;
}
