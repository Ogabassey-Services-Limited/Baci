'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useProductContext } from '@/contexts/product-context';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';
import type { Product } from '@/lib/products';
import { ExportToJumiaDialog } from './jumia/export-dialog';
import { mergeLocalProducts } from './merge-local-products';
import { ProductCatalogTable } from './product-catalog-table';
import { saveDirtyProducts } from './save-dirty-products';
import { useJumiaIntegrations } from './use-jumia-integrations';

interface ProductCatalogProps {
  statusFilter: string;
  stockFilter: string;
  onEditProduct?: (product: Product) => void;
}

export function ProductCatalog({
  statusFilter: _statusFilter,
  stockFilter: _stockFilter,
  onEditProduct,
}: ProductCatalogProps) {
  const { products, isLoading, pagination, setPage, updateProduct } =
    useProductContext();
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [localProducts, setLocalProducts] = useState(products);
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(new Set());
  const debouncedDirtyProducts = useDebounce(dirtyProducts, 1000);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  );
  const [exportProduct, setExportProduct] = useState<Product | null>(null);
  const localProductsRef = useRef(localProducts);
  const {
    jumiaIntegrations,
    jumiaIntegrationId,
    setJumiaIntegrationId,
    jumiaLoading,
  } = useJumiaIntegrations(merchant?.id, toast);

  useEffect(() => {
    localProductsRef.current = localProducts;
  }, [localProducts]);

  useEffect(() => {
    setLocalProducts((current) => {
      return mergeLocalProducts({
        current,
        dirtyProductIds: dirtyProducts,
        incoming: products,
      });
    });
  }, [dirtyProducts, products]);

  useEffect(() => {
    if (debouncedDirtyProducts.size === 0) return;

    setIsSaving(true);
    const saveChanges = async () => {
      try {
        const { failedIds, fulfilledIds, skippedIds } = await saveDirtyProducts(
          {
            dirtyProductIds: debouncedDirtyProducts,
            localProducts: localProductsRef.current,
            updateProduct,
          }
        );

        if (failedIds.length > 0) {
          console.error('Failed to save products', failedIds);
        }

        if (fulfilledIds.length > 0) {
          setDirtyProducts((current) => {
            const next = new Set(current);
            for (const id of fulfilledIds) {
              next.delete(id);
            }
            return next;
          });
        }

        if (failedIds.length === 0 && skippedIds.length === 0) {
          toast({
            title: 'Changes Saved',
            description: `Updated ${fulfilledIds.length} product(s).`,
          });
          return;
        }

        if (fulfilledIds.length > 0) {
          toast({
            title: 'Partial Save',
            description: `Saved ${fulfilledIds.length} product(s). ${failedIds.length + skippedIds.length} change(s) are still pending.`,
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Save Failed',
          description: 'Could not save changes. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    void saveChanges();
  }, [debouncedDirtyProducts, updateProduct, toast]);

  const toggleProduct = (productId: string) => {
    setExpandedProducts((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handlePriceChange = (productId: string, newPrice: string) => {
    const cleanPrice = newPrice.replace(/[^0-9.]/g, '');
    const priceValue = Number.parseFloat(cleanPrice);
    if (Number.isNaN(priceValue)) return;

    setLocalProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, price: priceValue } : product
      )
    );
    setDirtyProducts((current) => new Set(current).add(productId));
  };

  const handleStockChange = (
    productId: string,
    newStock: number,
    variantId?: string
  ) => {
    if (newStock < 0) return;

    setLocalProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;

        if (variantId && product.variants) {
          return {
            ...product,
            variants: product.variants.map((variant) =>
              variant.id === variantId
                ? { ...variant, stock_quantity: newStock }
                : variant
            ),
          };
        }

        return { ...product, stock: newStock };
      })
    );
    setDirtyProducts((current) => new Set(current).add(productId));
  };

  const formatCurrency = (amount: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  return (
    <Card className="flex-1 flex flex-col border border-border/40 shadow-sm bg-white/50 dark:bg-card/30 backdrop-blur-sm">
      <CardHeader className="px-6 py-4 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Product Catalog
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground/80">
              Manage your inventory, pricing, and stock levels.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ProductCatalogTable
          products={localProducts}
          expandedProducts={expandedProducts}
          dirtyProducts={dirtyProducts}
          isLoading={isLoading}
          isSaving={isSaving}
          jumiaLoading={jumiaLoading}
          jumiaIntegrationId={jumiaIntegrationId}
          jumiaIntegrations={jumiaIntegrations}
          onToggleProduct={toggleProduct}
          onPriceChange={handlePriceChange}
          onStockChange={handleStockChange}
          onEditProduct={onEditProduct}
          onExportProduct={setExportProduct}
          onSelectJumiaIntegration={(integrationId, product) => {
            setJumiaIntegrationId(integrationId);
            setExportProduct(product);
          }}
          formatCurrency={formatCurrency}
        />
      </CardContent>
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-muted/5">
          <div className="text-xs text-muted-foreground font-medium">
            Showing{' '}
            <span className="text-foreground">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>{' '}
            to{' '}
            <span className="text-foreground">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="text-foreground">{pagination.total}</span>{' '}
            products
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pagination.page - 1)}
              disabled={pagination.page === 1 || isLoading}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <div className="text-xs font-medium px-2">
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || isLoading}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {exportProduct && merchant && jumiaIntegrationId && (
        <ExportToJumiaDialog
          open={!!exportProduct}
          onOpenChange={(open) => !open && setExportProduct(null)}
          product={{
            id: exportProduct.id,
            sku: exportProduct.sku || '',
            name: exportProduct.name,
            description: exportProduct.description || '',
            price: exportProduct.price,
            images: exportProduct.image ? [exportProduct.image] : [],
          }}
          merchantId={merchant.id}
          integrationId={jumiaIntegrationId}
        />
      )}
    </Card>
  );
}
