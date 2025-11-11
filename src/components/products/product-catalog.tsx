
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDebounce } from '@/hooks/use-debounce';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function ProductCatalog() {
  const { filteredProducts, setProducts } = useProductContext();
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [localProducts, setLocalProducts] = useState(filteredProducts);
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(new Set());

  const debouncedDirtyProducts = useDebounce(dirtyProducts, 1000);

  useEffect(() => {
    setLocalProducts(filteredProducts);
  }, [filteredProducts]);

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  };

  const handlePriceChange = (productId: string, newPrice: string) => {
    const priceValue = parseFloat(newPrice);
    if (!isNaN(priceValue)) {
      setLocalProducts(current => current.map(p => p.id === productId ? { ...p, price: priceValue } : p));
      setDirtyProducts(prev => new Set(prev).add(productId));
    }
  };

  useEffect(() => {
    if (debouncedDirtyProducts.size > 0) {
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

      console.log('Auto-saving prices for:', Array.from(debouncedDirtyProducts));
      setDirtyProducts(new Set());
      toast({
        title: 'Prices auto-saved!',
        description: `Updated prices for ${debouncedDirtyProducts.size} product(s).`,
      });
    }
  }, [debouncedDirtyProducts, localProducts, setProducts, toast]);

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader>
        <CardTitle>Product Catalog</CardTitle>
        <CardDescription>
            Your current inventory. You can edit prices directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localProducts.map(product => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant={product.status === 'active' ? 'default' : 'outline'}>{product.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    defaultValue={product.price}
                    onChange={(e) => handlePriceChange(product.id, e.target.value)}
                    className="w-24 h-8 text-right ml-auto"
                    aria-label={`Price for ${product.name}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
