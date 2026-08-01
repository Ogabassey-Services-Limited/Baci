'use client';

import { Loader2, Package, Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { formatCurrency } from '@/lib/currency';

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  slug: string;
  status: string;
}

interface ProductEmbedPickerProps {
  merchantId?: string;
  open: boolean;
  onClose: () => void;
  onSelect: (products: Product[]) => void;
  selectedIds?: string[];
}

interface FetchProductsCallbacks {
  setProducts: (products: Product[]) => void;
  setIsLoading: (value: boolean) => void;
  setLoadError: (message: string | null) => void;
  signal?: AbortSignal;
}

async function fetchProducts(
  query: string,
  merchantId: string,
  { setProducts, setIsLoading, setLoadError, signal }: FetchProductsCallbacks
) {
  setIsLoading(true);
  try {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    params.set('merchantId', merchantId);
    const res = await fetch(`/api/products?${params.toString()}`, { signal });
    if (!res.ok) throw new Error('Failed to fetch products');
    const data = await res.json();
    if (!signal?.aborted) {
      setLoadError(null);
      setProducts(data.products || []);
    }
  } catch (error) {
    if (signal?.aborted) {
      return;
    }
    console.error('Error fetching products:', error);
    setLoadError('Failed to load products. Please try again.');
    setProducts([]);
  } finally {
    if (!signal?.aborted) {
      setIsLoading(false);
    }
  }
}

export function ProductEmbedPicker({
  merchantId,
  open,
  onClose,
  onSelect,
  selectedIds = [],
}: ProductEmbedPickerProps) {
  const [search, setSearch] = useState('');
  // ⚡ Bolt: Use standard useDebounce hook for network request debouncing
  // Why: Replaces unreliable custom setTimeout logic with proven hook to reduce API calls
  const debouncedSearch = useDebounce(search, 300);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (open && merchantId) {
      fetchProducts(debouncedSearch, merchantId, {
        setProducts,
        setIsLoading,
        setLoadError,
        signal: controller.signal,
      });
    } else if (open) {
      setProducts([]);
      setLoadError('Select a merchant before embedding products.');
      setIsLoading(false);
    }
    return () => controller.abort();
  }, [open, debouncedSearch, merchantId]);

  const toggleProduct = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleConfirm = () => {
    const selectedProducts = products.filter((p) => selected.has(p.id));
    onSelect(selectedProducts);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Products to Embed</DialogTitle>
          <DialogDescription>
            Choose products from the selected merchant to include in this post.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <div className="text-center py-8 text-destructive">
              <Package className="size-12 mx-auto mb-2 opacity-50" />
              <p>{loadError}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-12 mx-auto mb-2 opacity-50" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors w-full text-left ${
                    selected.has(product.id)
                      ? 'border-primary bg-primary/5'
                      : ''
                  }`}
                  onClick={() => toggleProduct(product.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      toggleProduct(product.id);
                    }
                  }}
                  type="button"
                >
                  <Checkbox
                    checked={selected.has(product.id)}
                    onCheckedChange={() => toggleProduct(product.id)}
                  />
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      width={48}
                      height={48}
                      className="object-cover rounded"
                    />
                  ) : (
                    <div className="size-12 bg-muted rounded flex items-center justify-center">
                      <Package className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(product.price)}
                      {product.compare_at_price &&
                        product.compare_at_price > product.price && (
                          <span className="ml-2 line-through text-xs">
                            {formatCurrency(product.compare_at_price)}
                          </span>
                        )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {selected.size > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {selected.size} product{selected.size > 1 ? 's' : ''} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Embed {selected.size} Product{selected.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
