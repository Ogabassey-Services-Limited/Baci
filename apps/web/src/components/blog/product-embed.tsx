'use client';

import { Loader2, Package, Search, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/currency';
import { isSafeSlug } from '@/lib/validate-slug';

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
  open: boolean;
  onClose: () => void;
  onSelect: (products: Product[]) => void;
  selectedIds?: string[];
}

export function ProductEmbedPicker({
  open,
  onClose,
  onSelect,
  selectedIds = [],
}: ProductEmbedPickerProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [isLoading, setIsLoading] = useState(false);

  const fetchProducts = async (query = '') => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  const handleSearch = (value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      fetchProducts(value);
    }, 300);
    return () => clearTimeout(timeout);
  };

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
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
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

interface ProductCardProps {
  product: Product;
  merchantSlug?: string;
  onAddToCart?: (productId: string) => void;
}

export function ProductCard({
  product,
  merchantSlug,
  onAddToCart,
}: ProductCardProps) {
  const hasDiscount =
    product.compare_at_price && product.compare_at_price > product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.price / (product.compare_at_price ?? 1)) * 100)
    : 0;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      {merchantSlug && isSafeSlug(merchantSlug) ? (
        <a
          href={`/${encodeURIComponent(merchantSlug)}/products/${encodeURIComponent(product.slug)}`}
        >
          <div className="aspect-square relative overflow-hidden bg-muted">
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            {hasDiscount && (
              <Badge className="absolute top-2 right-2" variant="destructive">
                -{discountPercentage}%
              </Badge>
            )}
          </div>
        </a>
      ) : (
        <div className="aspect-square relative overflow-hidden bg-muted">
          {product.images?.[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          {hasDiscount && (
            <Badge className="absolute top-2 right-2" variant="destructive">
              -{discountPercentage}%
            </Badge>
          )}
        </div>
      )}
      <CardContent className="p-4">
        {merchantSlug && isSafeSlug(merchantSlug) ? (
          <a
            href={`/${encodeURIComponent(merchantSlug)}/products/${encodeURIComponent(product.slug)}`}
          >
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </a>
        ) : (
          <h3 className="font-semibold line-clamp-2">{product.name}</h3>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="font-bold text-lg">
            {formatCurrency(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              {formatCurrency(product.compare_at_price ?? 0)}
            </span>
          )}
        </div>
        {onAddToCart && (
          <Button
            className="w-full mt-3"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(product.id);
            }}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface ProductGridProps {
  products: Product[];
  merchantSlug?: string;
  onAddToCart?: (productId: string) => void;
}

export function ProductGrid({
  products,
  merchantSlug,
  onAddToCart,
}: ProductGridProps) {
  if (products.length === 0) return null;

  return (
    <div className="my-8 not-prose">
      <div
        className={`grid gap-4 ${
          products.length === 1
            ? 'grid-cols-1 max-w-sm mx-auto'
            : products.length === 2
              ? 'grid-cols-2 max-w-xl mx-auto'
              : 'grid-cols-2 md:grid-cols-3'
        }`}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            merchantSlug={merchantSlug}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </div>
  );
}
