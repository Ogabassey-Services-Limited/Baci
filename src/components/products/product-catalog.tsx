
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
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProductCatalog() {
  const { filteredProducts, setProducts } = useProductContext();
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [localProducts, setLocalProducts] = useState(filteredProducts);
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(new Set());

  const debouncedDirtyProducts = useDebounce(dirtyProducts, 1000);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalProducts(filteredProducts);
  }, [filteredProducts]);

  const getCurrencySymbol = () => {
    if (!merchant?.country) return '$';
    const country = getCountryByCode(merchant.country);
    return country?.currencySymbol || '$';
  }

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
      // In a real app, you'd send this to your backend
      setProducts(currentGlobalProducts => {
        const updatedGlobalProducts = [...currentGlobalProducts];
        localProducts.forEach(localProduct => {
          if (debouncedDirtyProducts.has(localProduct.id)) {
            const index = updatedGlobalProducts.findIndex(p => p.id === localProduct.id);
            if (index !== -1) {
              updatedGlobalProducts[index] = localProduct;
            }
          }
        });
        return updatedGlobalProducts;
      });

      // Simulate save delay
      setTimeout(() => {
        toast({
            title: 'Changes Auto-Saved!',
            description: `Updated ${debouncedDirtyProducts.size} product(s).`,
        });
        setDirtyProducts(new Set());
        setIsSaving(false);
      }, 500);
    }
  }, [debouncedDirtyProducts, localProducts, setProducts, toast]);

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader>
        <CardTitle>Product Catalog</CardTitle>
        <CardDescription>
            Your current inventory. You can edit prices and stock directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localProducts.map(product => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{product.name}</span>
                    {isSaving && dirtyProducts.has(product.id) && (
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    )}
                  </div>
                  {product.mpn && <div className="text-xs text-muted-foreground">MPN: {product.mpn}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={product.status === 'active' ? 'default' : 'outline'}>{product.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="relative ml-auto w-28">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{getCurrencySymbol()}</span>
                     <Input
                        type="number"
                        defaultValue={product.price.toFixed(2)}
                        onBlur={(e) => handlePriceChange(product.id, e.target.value)}
                        className="h-9 text-right pr-4 pl-7"
                        aria-label={`Price for ${product.name}`}
                        step="0.01"
                      />
                  </div>
                </TableCell>
                <TableCell>
                    <div className="mx-auto w-20">
                        <Input
                            type="number"
                            value={product.stock}
                            onChange={(e) => handleStockChange(product.id, parseInt(e.target.value, 10) || 0)}
                            className="h-9 text-center remove-arrow"
                            aria-label={`Stock for ${product.name}`}
                        />
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
