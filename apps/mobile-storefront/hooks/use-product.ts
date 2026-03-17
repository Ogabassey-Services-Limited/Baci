import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import {
  CONSTANT_MERCHANT_ID,
  type ProductsPage,
  log,
  normalizeVariantAttributes,
  resolveAndEvictProduct,
  transformProduct,
} from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import { ProductRowSchema } from '@/lib/validation';
import type { Product } from '@/types/product';

function augmentProduct(item: z.infer<typeof ProductRowSchema>): Product {
  return {
    ...transformProduct(item),
    specifications: item.specifications,
    has_variants: item.has_variants || false,
    variant_attributes: normalizeVariantAttributes(item.variant_attributes),
    variants: [],
  } as Product;
}

export function useProduct(slug: string) {
  const queryClient = useQueryClient();
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  const query = useQuery({
    queryKey: ['product', slug, merchantId],
    queryFn: async () => {
      log.info('Fetching product:', slug);
      const data = await resolveAndEvictProduct(merchantId, slug, queryClient);

      const validated = ProductRowSchema.safeParse(data);
      if (!validated.success) {
        log.error('Product validation failed:', validated.error.format());
        throw new Error(`Product validation failed: ${validated.error.message}`);
      }

      const item = validated.data;

      return augmentProduct(item);
    },
    enabled: !!slug && !!merchantId,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
    initialData: () => {
      const productsCache = queryClient.getQueryData<{ pages: ProductsPage[] }>([
        'products',
        merchantId,
        {},
      ]);
      if (!productsCache) return undefined;

      for (const page of productsCache.pages) {
        const found = page.products.find((product) => product.slug === slug);
        if (found) {
          return {
            ...found,
            has_variants: found.has_variants || false,
            variant_attributes: normalizeVariantAttributes(
              found.variant_attributes
            ),
            variants: found.variants || [],
          } as Product;
        }
      }

      return undefined;
    },
  });

  return {
    product: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

export function usePrefetchProduct() {
  const queryClient = useQueryClient();
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return (slug: string) => {
    if (!merchantId) return;
    queryClient.prefetchQuery({
      queryKey: ['product', slug, merchantId],
      queryFn: async () => {
        const data = await resolveAndEvictProduct(merchantId, slug, queryClient);

        const validated = ProductRowSchema.safeParse(data);
        if (!validated.success) {
          log.error(
            'Prefetch product validation failed:',
            validated.error.format()
          );
          throw new Error(`Product validation failed: ${validated.error.message}`);
        }

        return augmentProduct(validated.data);
      },
    });
  };
}
