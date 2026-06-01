import type { getRequestScopedMerchant } from '@/lib/cached-data';
import type { Product } from '@/lib/products';

export interface PageProps {
  params: Promise<{
    slug: string;
    productSlug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export type ResolvedMerchant = NonNullable<
  Awaited<ReturnType<typeof getRequestScopedMerchant>>
>;

export interface ProductPageRuntimeProps {
  merchant: ResolvedMerchant;
  product: Product;
  slug: string;
}

export type ProductPageResolution =
  | {
      kind: 'product';
      runtimeProps: ProductPageRuntimeProps;
    }
  | { kind: 'route-not-found' };

export type ResolvedSearchParams = Awaited<PageProps['searchParams']>;
