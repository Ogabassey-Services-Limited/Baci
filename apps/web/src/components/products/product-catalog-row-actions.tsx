'use client';

import { Edit, Loader2, MoreHorizontal, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Product } from '@/lib/products';

interface ProductCatalogRowActionsProps {
  product: Product;
  jumiaLoading: boolean;
  jumiaIntegrationId: string | null;
  jumiaIntegrations: Array<{ id: string; shop_name: string }>;
  onEditProduct?: (product: Product) => void;
  onExportProduct: (product: Product) => void;
  onSelectJumiaIntegration: (integrationId: string, product: Product) => void;
}

export function ProductCatalogRowActions({
  product,
  jumiaLoading,
  jumiaIntegrationId,
  jumiaIntegrations,
  onEditProduct,
  onExportProduct,
  onSelectJumiaIntegration,
}: ProductCatalogRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {onEditProduct ? (
          <>
            <DropdownMenuItem onClick={() => onEditProduct(product)}>
              <Edit className="mr-2 h-4 w-4" />
              {product.migration_status === 'needs_review'
                ? 'Resolve Review'
                : 'Edit Product'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {jumiaIntegrations.length > 1 && !jumiaIntegrationId ? (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Select Jumia Shop
            </DropdownMenuLabel>
            {jumiaIntegrations.map((integration) => (
              <DropdownMenuItem
                key={integration.id}
                onClick={() =>
                  onSelectJumiaIntegration(integration.id, product)
                }
              >
                <Package className="mr-2 h-4 w-4" />
                {integration.shop_name || 'Jumia Shop'}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <DropdownMenuItem
            onClick={() => onExportProduct(product)}
            disabled={jumiaLoading || !jumiaIntegrationId}
            title={
              !jumiaIntegrationId ? 'Jumia integration required' : undefined
            }
          >
            {jumiaLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            Export to Jumia
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
