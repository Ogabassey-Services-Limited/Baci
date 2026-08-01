'use client';

import { Package, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';
import { isSafeSlug } from '@/lib/validate-slug';

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  images: string[];
  slug: string;
}

interface ProductGridProps {
  products: Product[];
  merchantSlug?: string;
  onAddToCart?: (productId: string) => void;
}

function ProductCard({
  product,
  merchantSlug,
  onAddToCart,
}: {
  product: Product;
  merchantSlug?: string;
  onAddToCart?: (productId: string) => void;
}) {
  const hasDiscount =
    product.compare_at_price && product.compare_at_price > product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.price / (product.compare_at_price ?? 1)) * 100)
    : 0;
  const productPath = merchantSlug
    ? `/${encodeURIComponent(merchantSlug)}/products/${encodeURIComponent(product.slug)}`
    : undefined;

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      {productPath && isSafeSlug(merchantSlug) ? (
        <a href={productPath}>
          <ProductImage
            product={product}
            hasDiscount={Boolean(hasDiscount)}
            discountPercentage={discountPercentage}
            interactive
          />
        </a>
      ) : (
        <ProductImage
          product={product}
          hasDiscount={Boolean(hasDiscount)}
          discountPercentage={discountPercentage}
        />
      )}
      <CardContent className="p-4">
        {productPath && isSafeSlug(merchantSlug) ? (
          <a href={productPath}>
            <h3 className="line-clamp-2 font-semibold transition-colors group-hover:text-primary">
              {product.name}
            </h3>
          </a>
        ) : (
          <h3 className="line-clamp-2 font-semibold">{product.name}</h3>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-bold">
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
            className="mt-3 w-full"
            size="sm"
            onClick={(event) => {
              event.preventDefault();
              onAddToCart(product.id);
            }}
          >
            <ShoppingCart className="mr-2 size-4" />
            Add to Cart
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ProductImage({
  product,
  hasDiscount,
  discountPercentage,
  interactive = false,
}: {
  product: Product;
  hasDiscount: boolean;
  discountPercentage: number;
  interactive?: boolean;
}) {
  return (
    <div className="relative aspect-square overflow-hidden bg-muted">
      {product.images?.[0] ? (
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className={
            interactive
              ? 'object-cover transition-transform duration-300 group-hover:scale-105'
              : 'object-cover'
          }
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-12 text-muted-foreground" />
        </div>
      )}
      {hasDiscount && (
        <Badge className="absolute right-2 top-2" variant="destructive">
          -{discountPercentage}%
        </Badge>
      )}
    </div>
  );
}

export function ProductGrid({
  products,
  merchantSlug,
  onAddToCart,
}: ProductGridProps) {
  if (products.length === 0) return null;

  const gridClassName =
    products.length === 1
      ? 'grid-cols-1 max-w-sm mx-auto'
      : products.length === 2
        ? 'grid-cols-2 max-w-xl mx-auto'
        : 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="my-8 not-prose">
      <div className={`grid gap-4 ${gridClassName}`}>
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
