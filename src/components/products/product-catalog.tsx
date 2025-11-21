
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDebounce } from '@/hooks/use-debounce';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Loader2, Infinity, Package, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/lib/products';
import Fuse from 'fuse.js';

interface ProductCatalogProps {
  statusFilter: string;
  stockFilter: string;
  onEditProduct?: (product: Product) => void;
}

export function ProductCatalog({ statusFilter, stockFilter, onEditProduct }: ProductCatalogProps) {
  const { products, isLoading, pagination, setPage, refetchProducts } = useProductContext();
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

  const handleStockChange = (productId: string, newStock: number) => {
    if (newStock < 0) return;
    setLocalProducts(current => current.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    setDirtyProducts(prev => new Set(prev).add(productId));
  };

  useEffect(() => {
    if (debouncedDirtyProducts.size > 0) {
      setIsSaving(true);
      // In a real app, you'd send this to your backend API
      // For now, we'll just simulate a save and refetch
      setTimeout(async () => {
        toast({
          title: 'Changes Auto-Saved!',
          description: `Updated ${debouncedDirtyProducts.size} product(s).`,
        });
        setDirtyProducts(new Set());
        setIsSaving(false);
        // Refetch to get latest data from server
        await refetchProducts();
      }, 500);
    }
  }, [debouncedDirtyProducts, toast, refetchProducts]);

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
              {localProducts.map(product => (
                <TableRow key={product.id} className="group hover:bg-muted/30 transition-colors border-b border-border/40">
                  <TableCell className="pl-6 py-3">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-border/50 bg-muted/20 shrink-0">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
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
                          {product.mpn && <span className="text-[11px] text-muted-foreground font-mono">SKU: {product.mpn}</span>}
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
                      product.status === 'published'
                        ? "bg-green-50 text-green-700 border-green-200/50"
                        : "bg-gray-50 text-gray-600 border-gray-200/50"
                    )}>
                      <span className={cn(
                        "mr-1.5 h-1.5 w-1.5 rounded-full",
                        product.status === 'published' ? "bg-green-500" : "bg-gray-400"
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
                    {product.manage_stock ? (
                      <div className="mx-auto w-24">
                        <Input
                          type="number"
                          value={product.stock}
                          onChange={(e) => handleStockChange(product.id, parseInt(e.target.value, 10) || 0)}
                          className={cn(
                            "h-8 text-center font-mono text-sm bg-transparent border-transparent hover:border-border/60 focus:border-primary/50 focus:bg-white transition-all shadow-none focus:shadow-sm remove-arrow rounded-md",
                            product.stock === 0 && "text-red-600 font-medium bg-red-50/50 hover:bg-red-50 hover:border-red-200"
                          )}
                          aria-label={`Stock for ${product.name}`}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground/70" title="Infinite Stock">
                        <Infinity className="h-4 w-4" />
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
              ))}
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
