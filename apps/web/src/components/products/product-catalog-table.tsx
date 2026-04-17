'use client';

import { Loader2, Package } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Product } from '@/lib/products';
import { ProductCatalogRow } from './product-catalog-row';

interface ProductCatalogTableProps {
  products: Product[];
  expandedProducts: Set<string>;
  dirtyProducts: Set<string>;
  isLoading: boolean;
  isSaving: boolean;
  jumiaLoading: boolean;
  jumiaIntegrationId: string | null;
  jumiaIntegrations: Array<{ id: string; shop_name: string }>;
  onToggleProduct: (productId: string) => void;
  onPriceChange: (productId: string, newPrice: string) => void;
  onStockChange: (
    productId: string,
    newStock: number,
    variantId?: string
  ) => void;
  onEditProduct?: (product: Product) => void;
  onExportProduct: (product: Product) => void;
  onSelectJumiaIntegration: (integrationId: string, product: Product) => void;
  currencySymbol: string;
  locale: string;
  formatCurrency: (amount: number) => string;
}

export function ProductCatalogTable({
  products,
  expandedProducts,
  dirtyProducts,
  isLoading,
  isSaving,
  jumiaLoading,
  jumiaIntegrationId,
  jumiaIntegrations,
  onToggleProduct,
  onPriceChange,
  onStockChange,
  onEditProduct,
  onExportProduct,
  onSelectJumiaIntegration,
  currencySymbol,
  locale,
  formatCurrency,
}: ProductCatalogTableProps) {
  const shouldRenderTable = !isLoading || products.length > 0;

  return (
    <div className="h-full overflow-y-auto overflow-x-auto">
      {shouldRenderTable ? (
        <Table className="min-w-[800px]">
          <TableHeader className="sticky top-0 bg-white/95 dark:bg-background/95 backdrop-blur-md z-10 shadow-sm">
            <TableRow className="hover:bg-transparent border-b border-primary/10">
              <TableHead className="w-[400px]">Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, index) => (
              <ProductCatalogRow
                key={product.id}
                product={product}
                index={index}
                isExpanded={expandedProducts.has(product.id)}
                isSaving={isSaving}
                isDirty={dirtyProducts.has(product.id)}
                jumiaLoading={jumiaLoading}
                jumiaIntegrationId={jumiaIntegrationId}
                jumiaIntegrations={jumiaIntegrations}
                onToggleProduct={onToggleProduct}
                onPriceChange={onPriceChange}
                onStockChange={onStockChange}
                onEditProduct={onEditProduct}
                onExportProduct={onExportProduct}
                onSelectJumiaIntegration={onSelectJumiaIntegration}
                currencySymbol={currencySymbol}
                locale={locale}
                formatCurrency={formatCurrency}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <span className="text-sm font-medium">Loading catalog...</span>
        </div>
      )}
      {!isLoading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <h3 className="text-sm font-medium text-foreground">
            No products found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            Try adjusting your filters or add a new product.
          </p>
        </div>
      )}
    </div>
  );
}
