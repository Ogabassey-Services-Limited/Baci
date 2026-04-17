'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Infinity as InfinityIcon,
  Loader2,
  Package,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Product } from '@/lib/products';
import { cn } from '@/lib/utils';
import { ProductCatalogRowActions } from './product-catalog-row-actions';
import { ProductCatalogVariantRow } from './product-catalog-variant-row';
import { formatPriceInput, parsePriceInput } from './product-currency-input';
import { ProductMigrationBadges } from './product-migration-badges';

interface ProductCatalogRowProps {
  product: Product;
  index: number;
  isExpanded: boolean;
  isSaving: boolean;
  isDirty: boolean;
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

export function ProductCatalogRow({
  product,
  index,
  isExpanded,
  isSaving,
  isDirty,
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
}: ProductCatalogRowProps) {
  const isLowStock = !product.manage_stock
    ? false
    : product.stock <= (product.low_stock_threshold ?? 5);

  return (
    <>
      <TableRow
        className={cn(
          'group hover:bg-muted/30 transition-colors border-b border-primary/5',
          product.variants && product.variants.length > 0 && 'bg-muted/5'
        )}
      >
        <TableCell className="pl-6 py-3">
          <div className="flex items-center gap-4">
            {product.variants && product.variants.length > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-transparent"
                onClick={() => onToggleProduct(product.id)}
                aria-label={
                  isExpanded ? 'Collapse variants' : 'Expand variants'
                }
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-border/50 bg-muted/20 shrink-0">
              {product.image ? (
                <Image
                  src={product.image}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  aria-hidden="true"
                  priority={index < 4}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                  <Package className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    product.status === 'active'
                      ? 'bg-green-500'
                      : product.status === 'draft'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  )}
                  title={`Status: ${product.status}`}
                />
                {product.name}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <ProductMigrationBadges
                  migrationStatus={product.migration_status}
                  variantModel={product.variant_model}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {product.sku && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    SKU: {product.sku}
                  </span>
                )}
                {isSaving && isDirty && (
                  <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="relative ml-auto w-40 group/input">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70 font-medium">
              {currencySymbol}
            </span>
            <Input
              id={`price-${product.id}`}
              name={`price-${product.id}`}
              type="text"
              defaultValue={formatPriceInput(product.price, locale)}
              onBlur={(event) => {
                onPriceChange(product.id, event.target.value);
                const value = parsePriceInput(event.target.value, locale);
                if (!Number.isNaN(value)) {
                  event.target.value = formatPriceInput(value, locale);
                }
              }}
              className="h-9 text-right pr-3 pl-6 font-mono text-sm bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-background transition-all shadow-none focus:shadow-sm"
              aria-label={`Price for ${product.name}`}
            />
          </div>
        </TableCell>
        <TableCell>
          {product.manage_stock &&
          (!product.variants || product.variants.length === 0) ? (
            <div className="mx-auto w-24 relative">
              <Input
                id={`stock-${product.id}`}
                name={`stock-${product.id}`}
                type="number"
                value={product.stock}
                onChange={(event) =>
                  onStockChange(
                    product.id,
                    Number.parseInt(event.target.value, 10) || 0
                  )
                }
                className={cn(
                  'h-8 text-center font-mono text-sm bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-accent transition-all shadow-none focus:shadow-sm remove-arrow rounded-md',
                  product.stock === 0 &&
                    'text-red-600 font-medium bg-red-50/50 hover:bg-red-50 hover:border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40',
                  isLowStock &&
                    product.stock > 0 &&
                    'text-amber-600 font-medium bg-amber-50/50 hover:bg-amber-50 hover:border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40'
                )}
                aria-label={`Stock for ${product.name}`}
              />
              {isLowStock && (
                <div
                  className="absolute -right-6 top-1/2 -translate-y-1/2"
                  title={`Low Stock (Threshold: ${product.low_stock_threshold ?? 5})`}
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
              )}
            </div>
          ) : product.variants && product.variants.length > 0 ? (
            <div className="text-center text-xs text-muted-foreground italic">
              See variants
            </div>
          ) : (
            <div
              className="flex items-center justify-center gap-1.5 text-muted-foreground/70"
              title="Infinite Stock"
            >
              <InfinityIcon className="h-4 w-4" />
            </div>
          )}
        </TableCell>
        <TableCell>
          <ProductCatalogRowActions
            product={product}
            jumiaLoading={jumiaLoading}
            jumiaIntegrationId={jumiaIntegrationId}
            jumiaIntegrations={jumiaIntegrations}
            onEditProduct={onEditProduct}
            onExportProduct={onExportProduct}
            onSelectJumiaIntegration={onSelectJumiaIntegration}
          />
        </TableCell>
      </TableRow>
      {isExpanded &&
        product.variants?.map((variant) => (
          <ProductCatalogVariantRow
            key={variant.id}
            product={product}
            variant={variant}
            formatCurrency={formatCurrency}
            onStockChange={onStockChange}
          />
        ))}
    </>
  );
}
