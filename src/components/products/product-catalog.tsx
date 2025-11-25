
'use client';

import { useProductContext } from '@/contexts/product-context';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDebounce } from '@/hooks/use-debounce';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Infinity as InfinityIcon, Package, Edit, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/lib/products';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface ProductCatalogProps {
  statusFilter: string;
  stockFilter: string;
  onEditProduct?: (product: Product) => void;
}

export function ProductCatalog({ statusFilter: _statusFilter, stockFilter: _stockFilter, onEditProduct }: ProductCatalogProps) {
  const { products, isLoading, pagination, setPage, refetchProducts, updateProduct } = useProductContext();
  const { merchant } = useMerchant();
  const { toast } = useToast();

  const [localProducts, setLocalProducts] = useState(products);
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(new Set());

  const debouncedDirtyProducts = useDebounce(dirtyProducts, 1000);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);


  const handlePriceChange = (productId: string, newPrice: string) => {
    const priceValue = parseFloat(newPrice);
    if (!isNaN(priceValue)) {
      setLocalProducts(current => current.map(p => p.id === productId ? { ...p, price: priceValue } : p));
      setDirtyProducts(prev => new Set(prev).add(productId));
    }
  };

  const handleStockChange = (productId: string, newStock: number, variantId?: string) => {
    if (newStock < 0) return;
    setLocalProducts(current => current.map(p => {
      if (p.id !== productId) return p;

      if (variantId && p.variants) {
        return {
          ...p,
          variants: p.variants.map(v => v.id === variantId ? { ...v, stock_quantity: newStock } : v)
        };
      }

      return { ...p, stock: newStock };
    }));
    setDirtyProducts(prev => new Set(prev).add(productId));
  };

  useEffect(() => {
    if (debouncedDirtyProducts.size > 0) {
      setIsSaving(true);
      const saveChanges = async () => {
        try {
          const promises = Array.from(debouncedDirtyProducts).map(async (id) => {
            const product = localProducts.find(p => p.id === id);
            if (product) {
              await updateProduct(product);
            }
          });

          await Promise.all(promises);

          toast({
            title: 'Changes Saved',
            description: `Updated ${debouncedDirtyProducts.size} product(s).`,
          });
          setDirtyProducts(new Set());
        } catch (error) {
          console.error("Failed to save changes", error);
          toast({
            title: 'Save Failed',
            description: 'Could not save changes. Please try again.',
            variant: 'destructive'
          });
        } finally {
          setIsSaving(false);
        }
      };

      saveChanges();
    }
  }, [debouncedDirtyProducts, localProducts, updateProduct, toast]);

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
    }).format(amount);
  };

  return (
    <Card className="flex-1 flex flex-col border-none shadow-sm bg-white/50 backdrop-blur-sm">
      <CardHeader className="px-6 py-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Product Catalog</CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground/80">
              Manage your inventory, pricing, and stock levels.
            </CardDescription>
          </div>
          {/* Future: Add bulk actions or view toggle here */}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-md z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="w-[400px] pl-6">Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localProducts.map(product => {
                const isLowStock = !product.manage_stock ? false : (product.stock <= (product.low_stock_threshold || 5));
                return (
                  <React.Fragment key={product.id}>
                    <TableRow className={cn("group hover:bg-muted/30 transition-colors border-b border-border/40", product.variants && product.variants.length > 0 && "bg-muted/5")}>
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-4">
                          <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-border/50 bg-muted/20 shrink-0">
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground/90 group-hover:text-primary transition-colors">
                              {product.name}
                            </span>
                            <div className="flex items-center gap-2">
                              {product.sku && <span className="text-[11px] text-muted-foreground font-mono">SKU: {product.sku}</span>}
                              {isSaving && dirtyProducts.has(product.id) && (
                                <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium animate-pulse">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Saving...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          product.status === 'active'
                            ? "bg-green-50 text-green-700 border-green-200/50"
                            : product.status === 'draft'
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200/50"
                              : "bg-gray-50 text-gray-600 border-gray-200/50"
                        )}>
                          <span className={cn(
                            "mr-1.5 h-1.5 w-1.5 rounded-full",
                            product.status === 'active' ? "bg-green-500" : product.status === 'draft' ? "bg-yellow-500" : "bg-gray-400"
                          )} />
                          <span className="capitalize">{product.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="relative ml-auto w-28 group/input">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70 font-medium">
                            {formatCurrency(0).replace(/[0-9.,\s]/g, '')}
                          </span>
                          <Input
                            type="number"
                            defaultValue={product.price.toFixed(2)}
                            onBlur={(e) => handlePriceChange(product.id, e.target.value)}
                            className="h-9 text-left pr-3 pl-6 font-mono text-sm bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-white transition-all shadow-none focus:shadow-sm"
                            aria-label={`Price for ${product.name}`}
                            step="0.01"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.manage_stock && (!product.variants || product.variants.length === 0) ? (
                          <div className="mx-auto w-24 relative">
                            <Input
                              type="number"
                              value={product.stock}
                              onChange={(e) => handleStockChange(product.id, parseInt(e.target.value, 10) || 0)}
                              className={cn(
                                "h-8 text-center font-mono text-sm bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-white transition-all shadow-none focus:shadow-sm remove-arrow rounded-md",
                                product.stock === 0 && "text-red-600 font-medium bg-red-50/50 hover:bg-red-50 hover:border-red-200",
                                isLowStock && product.stock > 0 && "text-amber-600 font-medium bg-amber-50/50 hover:bg-amber-50 hover:border-amber-200"
                              )}
                              aria-label={`Stock for ${product.name}`}
                            />
                            {isLowStock && (
                              <div className="absolute -right-6 top-1/2 -translate-y-1/2" title={`Low Stock (Threshold: ${product.low_stock_threshold || 5})`}>
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </div>
                            )}
                          </div>
                        ) : product.variants && product.variants.length > 0 ? (
                          <div className="text-center text-xs text-muted-foreground italic">
                            See variants
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 text-muted-foreground/70" title="Infinite Stock">
                            <InfinityIcon className="h-4 w-4" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={() => onEditProduct?.(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {product.variants?.map(variant => {
                      const isVariantLowStock = variant.stock_quantity <= (product.low_stock_threshold || 5);
                      return (
                        <TableRow key={variant.id} className="bg-muted/10 hover:bg-muted/20 border-b border-border/40">
                          <TableCell className="pl-12 py-2">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded overflow-hidden border border-border/50 bg-background shrink-0">
                                {variant.primary_image ? (
                                  <Image
                                    src={variant.primary_image}
                                    alt="Variant"
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
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
                                {variant.sku && <span className="text-[10px] text-muted-foreground/70 font-mono">SKU: {variant.sku}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell></TableCell>
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
                                type="number"
                                value={variant.stock_quantity}
                                onChange={(e) => handleStockChange(product.id, parseInt(e.target.value, 10) || 0, variant.id)}
                                className={cn(
                                  "h-7 text-center font-mono text-xs bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-white transition-all shadow-none focus:shadow-sm remove-arrow rounded-md",
                                  variant.stock_quantity === 0 && "text-red-600 font-medium bg-red-50/50 hover:bg-red-50 hover:border-red-200",
                                  isVariantLowStock && variant.stock_quantity > 0 && "text-amber-600 font-medium bg-amber-50/50 hover:bg-amber-50 hover:border-amber-200"
                                )}
                              />
                              {isVariantLowStock && (
                                <div className="absolute -right-6 top-1/2 -translate-y-1/2" title={`Low Stock (Threshold: ${product.low_stock_threshold || 5})`}>
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <span className="text-sm font-medium">Loading catalog...</span>
            </div>
          )}
          {!isLoading && localProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <h3 className="text-sm font-medium text-foreground">No products found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Try adjusting your filters or add a new product.
              </p>
            </div>
          )}
        </div>
      </CardContent>
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-muted/5">
          <div className="text-xs text-muted-foreground font-medium">
            Showing <span className="text-foreground">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-foreground">{pagination.total}</span> products
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
    </Card>
  );
}
