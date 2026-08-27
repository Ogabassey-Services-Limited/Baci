'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { getCurrencyCode } from '@/lib/currency';
import type { PublishProduct } from '@/schemas/jumia/publish-products';
import {
  loadMappedProductIds,
  loadPublishProducts,
} from './publish-products-data-loader';
import {
  buildJumiaPublishPayload,
  getJumiaPublishBlockReason,
} from './publish-products-payload';

const PUBLISH_CONCURRENCY = 3;
const MIXED_PRODUCT_METADATA_REASON =
  'Select products with the same category and brand as the first selected product.';

type UsePublishProductsDialogArgs = {
  integrationId: string;
  countryCode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function usePublishProductsDialog({
  integrationId,
  countryCode = 'NG',
  open,
  onOpenChange,
}: UsePublishProductsDialogArgs) {
  const { toast } = useToast();
  const [products, setProducts] = useState<PublishProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryCode, setCategoryCode] = useState<number | null>(null);
  const [brand, setBrand] = useState<{ code: number; name: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mappedProductIds, setMappedProductIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    Promise.all([
      loadPublishProducts(undefined, controller.signal),
      loadMappedProductIds(integrationId, controller.signal),
    ])
      .then(([loadedProducts, mappedIds]) => {
        setProducts(loadedProducts);
        setMappedProductIds(mappedIds);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load products'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [open, integrationId]);

  const getPublishBlockReason = (product: PublishProduct): string | null => {
    if (mappedProductIds.has(product.id)) {
      return 'Already published to this Jumia integration.';
    }
    const productReason = getJumiaPublishBlockReason(product);
    if (productReason) return productReason;

    const firstSelectedProduct = products.find((candidate) =>
      selectedIds.has(candidate.id)
    );
    if (
      firstSelectedProduct &&
      !selectedIds.has(product.id) &&
      (firstSelectedProduct.category?.trim().toLocaleLowerCase() ?? '') !==
        (product.category?.trim().toLocaleLowerCase() ?? '')
    ) {
      return MIXED_PRODUCT_METADATA_REASON;
    }
    if (
      firstSelectedProduct &&
      !selectedIds.has(product.id) &&
      (firstSelectedProduct.brand?.trim().toLocaleLowerCase() ?? '') !==
        (product.brand?.trim().toLocaleLowerCase() ?? '')
    ) {
      return MIXED_PRODUCT_METADATA_REASON;
    }
    return null;
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggleProduct = (productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product || getPublishBlockReason(product)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const submit = () => {
    const selected = products.filter((product) => selectedIds.has(product.id));
    if (!categoryCode || !brand || selected.length === 0) {
      toast({
        title: 'Complete the selection',
        description:
          'Choose at least one product, a Jumia category, and a brand.',
        variant: 'destructive',
      });
      return;
    }

    const invalid = selected.find(
      (product) =>
        !product.sku?.trim() &&
        (!(product.variants ?? []).length ||
          (product.variants ?? []).some(
            (variant) =>
              variant.is_inventory_anchor !== true && !variant.sku?.trim()
          ))
    );
    if (invalid) {
      toast({
        title: 'SKU required',
        description: `${invalid.name} needs a SKU for every variant before it can be submitted to Jumia.`,
        variant: 'destructive',
      });
      return;
    }

    const blocked = selected.find(
      (product) => getPublishBlockReason(product) !== null
    );
    if (blocked) {
      toast({
        title: 'Product not ready for Jumia',
        description: `${blocked.name}: ${getPublishBlockReason(blocked)}`,
        variant: 'destructive',
      });
      return;
    }

    const firstSelectedProduct = selected[0];
    const hasMixedProductMetadata = selected.some(
      (product) =>
        (product.category?.trim().toLocaleLowerCase() ?? '') !==
          (firstSelectedProduct?.category?.trim().toLocaleLowerCase() ?? '') ||
        (product.brand?.trim().toLocaleLowerCase() ?? '') !==
          (firstSelectedProduct?.brand?.trim().toLocaleLowerCase() ?? '')
    );
    if (hasMixedProductMetadata) {
      toast({
        title: 'Choose one product group per batch',
        description: MIXED_PRODUCT_METADATA_REASON,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const marketplaceCurrency = getCurrencyCode(countryCode);
    const submitProduct = async (product: PublishProduct) => {
      const response = await fetchWithCsrf(
        '/api/marketplace/jumia/products/export',
        {
          method: 'POST',
          body: JSON.stringify(
            buildJumiaPublishPayload(
              product,
              integrationId,
              categoryCode,
              brand,
              marketplaceCurrency
            )
          ),
        }
      );
      return {
        ok: response.ok && (response.status ?? 200) < 207,
        body: await response.json().catch(() => ({})),
      };
    };

    (async () => {
      const results = [];
      for (
        let index = 0;
        index < selected.length;
        index += PUBLISH_CONCURRENCY
      ) {
        const batch = selected.slice(index, index + PUBLISH_CONCURRENCY);
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
    })()
      .then((results) => {
        const succeeded = results.filter((result) => result.ok).length;
        const failed = results.length - succeeded;
        if (succeeded > 0) {
          toast({
            title: 'Products submitted to Jumia',
            description: `${succeeded} product${succeeded === 1 ? '' : 's'} is pending Jumia approval.${failed ? ` ${failed} failed.` : ''}`,
          });
          onOpenChange(false);
        } else {
          toast({
            title: 'Submission failed',
            description: String(
              results[0]?.body?.error || 'Jumia rejected the product feed.'
            ),
            variant: 'destructive',
          });
        }
      })
      .catch(() => {
        toast({
          title: 'Submission failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => setSubmitting(false));
  };

  return {
    products,
    selectedIds,
    search,
    setSearch,
    categoryCode,
    setCategoryCode,
    brand,
    setBrand,
    loading,
    submitting,
    loadError,
    filteredProducts,
    getPublishBlockReason,
    toggleProduct,
    submit,
  };
}
