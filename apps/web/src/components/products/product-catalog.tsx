'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit,
  Infinity as InfinityIcon,
  Loader2,
  MoreHorizontal,
  Package,
} from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProductContext } from '@/contexts/product-context';
import { useDebounce } from '@/hooks/use-debounce';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';
import type { Product } from '@/lib/products';
import { cn } from '@/lib/utils';
import { ExportToJumiaDialog } from './jumia/export-dialog';
import { ProductMigrationBadges } from './product-migration-badges';

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
  const [jumiaIntegrations, setJumiaIntegrations] = useState<
    Array<{ id: string; shop_name: string }>
  >([]);
  const [jumiaIntegrationId, setJumiaIntegrationId] = useState<string | null>(
    null
  );
  const [jumiaLoading, setJumiaLoading] = useState(false);

  // Fetch active Jumia integrations for product export
  useEffect(() => {
    if (!merchant?.id) return;
    // Reset to avoid stale integration data when merchant changes
    setJumiaIntegrations([]);
    setJumiaIntegrationId(null);
    setJumiaLoading(true);
    const controller = new AbortController();
    fetch('/api/marketplace/jumia/connect', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(
            `Failed to fetch integrations: ${res.status} ${body}`
          );
        }
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const integrations = Array.isArray(data.integrations)
          ? data.integrations.filter(
              (
                i: unknown
              ): i is { id: string; shop_name: string; [k: string]: unknown } =>
                typeof i === 'object' &&
                i !== null &&
                typeof (i as Record<string, unknown>).id === 'string'
            )
          : [];
        setJumiaIntegrations(integrations);
        // Auto-select only when exactly one integration exists
        if (integrations.length === 1) {
          setJumiaIntegrationId(integrations[0].id);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to fetch Jumia integration:', err);
        toast({
          title: 'Jumia Integration',
          description:
            'Could not load Jumia integration. Export may be unavailable.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setJumiaLoading(false);
        }
      });
    return () => controller.abort();
  }, [merchant?.id, toast]);

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  const handlePriceChange = (productId: string, newPrice: string) => {
    // Remove all characters except digits and dots
    const cleanPrice = newPrice.replace(/[^0-9.]/g, '');
    const priceValue = Number.parseFloat(cleanPrice);
    if (!Number.isNaN(priceValue)) {
      setLocalProducts((current) =>
        current.map((p) =>
          p.id === productId ? { ...p, price: priceValue } : p
        )
      );
      setDirtyProducts((prev) => new Set(prev).add(productId));
    }
  };

  const handleStockChange = (
    productId: string,
    newStock: number,
    variantId?: string
  ) => {
    if (newStock < 0) return;
    setLocalProducts((current) =>
      current.map((p) => {
        if (p.id !== productId) return p;

        if (variantId && p.variants) {
          return {
            ...p,
            variants: p.variants.map((v) =>
              v.id === variantId ? { ...v, stock_quantity: newStock } : v
            ),
          };
        }

        return { ...p, stock: newStock };
      })
    );
    setDirtyProducts((prev) => new Set(prev).add(productId));
  };

  useEffect(() => {
    if (debouncedDirtyProducts.size > 0) {
      setIsSaving(true);
      const saveChanges = async () => {
        try {
          const promises = Array.from(debouncedDirtyProducts).map(
            async (id) => {
              const product = localProducts.find((p) => p.id === id);
              if (product) {
                await updateProduct(product);
              }
            }
          );

          await Promise.all(promises);

          toast({
            title: 'Changes Saved',
            description: `Updated ${debouncedDirtyProducts.size} product(s).`,
          });
          setDirtyProducts(new Set());
        } catch (error) {
          console.error('Failed to save changes', error);
          toast({
            title: 'Save Failed',
            description: 'Could not save changes. Please try again.',
            variant: 'destructive',
          });
        } finally {
          setIsSaving(false);
        }
      };

      saveChanges();
    }
  }, [debouncedDirtyProducts, localProducts, updateProduct, toast]);

  const formatCurrency = (amount: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
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
          {/* Future: Add bulk actions or view toggle here */}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="sticky top-0 bg-white/95 dark:bg-background/95 backdrop-blur-md z-10 shadow-sm">
              <TableRow className="hover:bg-transparent border-b border-primary/10">
                <TableHead className="w-[400px]">Product</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {localProducts.map((product, index) => {
                const isLowStock = !product.manage_stock
                  ? false
                  : product.stock <= (product.low_stock_threshold || 5);
                return (
                  <React.Fragment key={product.id}>
                    <TableRow
                      className={cn(
                        'group hover:bg-muted/30 transition-colors border-b border-primary/5',
                        product.variants &&
                          product.variants.length > 0 &&
                          'bg-muted/5'
                      )}
                    >
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-4">
                          {product.variants && product.variants.length > 0 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-transparent"
                              onClick={() => toggleProduct(product.id)}
                              aria-label={
                                expandedProducts.has(product.id)
                                  ? 'Collapse variants'
                                  : 'Expand variants'
                              }
                            >
                              {expandedProducts.has(product.id) ? (
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
                      <TableCell className="text-right">
                        <div className="relative ml-auto w-40 group/input">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70 font-medium">
                            {formatCurrency(0).replace(/[0-9.,\s]/g, '')}
                          </span>
                          <Input
                            id={`price-${product.id}`}
                            name={`price-${product.id}`}
                            type="text"
                            defaultValue={product.price.toLocaleString(
                              'en-US',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                            onBlur={(e) => {
                              handlePriceChange(product.id, e.target.value);
                              // Re-format the input value on blur
                              const val = Number.parseFloat(
                                e.target.value.replace(/[^0-9.]/g, '')
                              );
                              if (!Number.isNaN(val)) {
                                e.target.value = val.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                });
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
                              onChange={(e) =>
                                handleStockChange(
                                  product.id,
                                  Number.parseInt(e.target.value, 10) || 0
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
                                title={`Low Stock (Threshold: ${product.low_stock_threshold || 5})`}
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => onEditProduct?.(product)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {product.migration_status === 'needs_review'
                                ? 'Resolve Review'
                                : 'Edit Product'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {jumiaIntegrations.length > 1 &&
                            !jumiaIntegrationId ? (
                              <>
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  Select Jumia Shop
                                </DropdownMenuLabel>
                                {jumiaIntegrations.map((integration) => (
                                  <DropdownMenuItem
                                    key={integration.id}
                                    onClick={() => {
                                      setJumiaIntegrationId(integration.id);
                                      setExportProduct(product);
                                    }}
                                  >
                                    <Package className="mr-2 h-4 w-4" />
                                    {integration.shop_name || 'Jumia Shop'}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setExportProduct(product)}
                                disabled={jumiaLoading || !jumiaIntegrationId}
                                title={
                                  !jumiaIntegrationId
                                    ? 'Jumia integration required'
                                    : undefined
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
                      </TableCell>
                    </TableRow>
                    {expandedProducts.has(product.id) &&
                      product.variants?.map((variant) => {
                        const isVariantLowStock =
                          variant.stock_quantity <=
                          (product.low_stock_threshold || 5);
                        return (
                          <TableRow
                            key={variant.id}
                            className="bg-muted/10 hover:bg-muted/20 border-b border-border/40"
                          >
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
                                    {Object.values(variant.attributes).join(
                                      ' / '
                                    )}
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
                                  onChange={(e) =>
                                    handleStockChange(
                                      product.id,
                                      Number.parseInt(e.target.value, 10) || 0,
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
              <h3 className="text-sm font-medium text-foreground">
                No products found
              </h3>
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
