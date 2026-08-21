import type { PublishProduct } from '@/schemas/jumia/publish-products';
import {
  MAX_PRODUCT_PAGES,
  publishProductSchema,
  publishProductsPageSchema,
} from '@/schemas/jumia/publish-products';

export async function loadMappedProductIds(
  integrationId: string,
  signal: AbortSignal
): Promise<Set<string>> {
  const response = await fetch(
    `/api/marketplace/jumia/products/mapped-product-ids?integrationId=${integrationId}`,
    { signal }
  );
  if (!response.ok) {
    throw new Error('Failed to load mapped Jumia products');
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('productIds' in payload) ||
    !Array.isArray(payload.productIds)
  ) {
    throw new Error('Failed to load mapped Jumia products');
  }
  return new Set(
    payload.productIds.filter(
      (productId): productId is string => typeof productId === 'string'
    )
  );
}

export async function loadPublishProducts(
  search: string | undefined,
  signal: AbortSignal
): Promise<PublishProduct[]> {
  const products: PublishProduct[] = [];
  let page = 1;
  const limit = 100;

  while (page <= MAX_PRODUCT_PAGES) {
    const params = new URLSearchParams({
      status: 'active',
      limit: String(limit),
      page: String(page),
    });
    if (search?.trim()) {
      params.set('search', search.trim());
    }

    const response = await fetch(`/api/products?${params}`, { signal });
    if (!response.ok) throw new Error('Failed to load active products');
    const payload: unknown = await response.json();
    const parsed = publishProductsPageSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error('Failed to load active products');
    }

    const pageProducts = parsed.data.products.flatMap((product) => {
      const validated = publishProductSchema.safeParse(product);
      return validated.success ? [validated.data] : [];
    });
    products.push(...pageProducts);

    const totalPages = parsed.data.pagination?.totalPages ?? 1;
    if (page >= totalPages || pageProducts.length === 0) {
      break;
    }
    page += 1;
  }

  return products;
}
