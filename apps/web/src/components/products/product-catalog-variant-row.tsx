'use client';

import { AlertTriangle, Package } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Product } from '@/lib/products';
import { cn } from '@/lib/utils';

interface ProductCatalogVariantRowProps {
  product: Product;
  variant: NonNullable<Product['variants']>[number];
  formatCurrency: (amount: number) => string;
  onStockChange: (
    productId: string,
    newStock: number,
    variantId?: string
  ) => void;
}

export function ProductCatalogVariantRow({
  product,
  variant,
  formatCurrency,
  onStockChange,
}: ProductCatalogVariantRowProps) {
  const isVariantLowStock =
    variant.stock_quantity <= (product.low_stock_threshold || 5);

  return (
    <TableRow className="bg-muted/10 hover:bg-muted/20 border-b border-border/40">
      <TableCell className="pl-12 py-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded overflow-hidden border border-border/50 bg-background shrink-0">
            {variant.primary_image ? (
              <Image
                src={variant.primary_image}
                alt=""
                width={32}
                height={32}
                sizes="32px"
                className="h-full w-full object-cover"
                aria-hidden="true"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground/20">
                <Package className="h-3 w-3" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {Object.values(variant.attributes).join(' / ')}
            </span>
            {variant.sku && (
              <span className="text-[10px] text-muted-foreground/70 font-mono">
                SKU: {variant.sku}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {variant.price_override && (
          <span className="text-sm text-muted-foreground font-mono">
            {formatCurrency(variant.price_override)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="mx-auto w-24 relative">
          <Input
            id={`variant-stock-${variant.id}`}
            name={`variant-stock-${variant.id}`}
            type="number"
            value={variant.stock_quantity}
            onChange={(event) =>
              onStockChange(
                product.id,
                Number.parseInt(event.target.value, 10) || 0,
                variant.id
              )
            }
            className={cn(
              'h-7 text-center font-mono text-xs bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-accent transition-all shadow-none focus:shadow-sm remove-arrow rounded-md',
              variant.stock_quantity === 0 &&
                'text-red-600 font-medium bg-red-50/50 hover:bg-red-50 hover:border-red-200',
              isVariantLowStock &&
                variant.stock_quantity > 0 &&
                'text-amber-600 font-medium bg-amber-50/50 hover:bg-amber-50 hover:border-amber-200'
            )}
            aria-label={`Stock for variant ${Object.values(variant.attributes).join(', ')}`}
          />
          {isVariantLowStock && (
            <div
              className="absolute -right-6 top-1/2 -translate-y-1/2"
              title={`Low Stock (Threshold: ${product.low_stock_threshold || 5})`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </div>
          )}
        </div>
      </TableCell>
      <TableCell />
    </TableRow>
  );
}
