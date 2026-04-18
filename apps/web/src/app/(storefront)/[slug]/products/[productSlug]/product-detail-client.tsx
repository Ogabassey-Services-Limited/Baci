'use client';

import { Check, Info, Minus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/storefront/breadcrumbs';
import { StickyAddToCart } from '@/components/storefront/sticky-add-to-cart';
import { ThemedBadge, ThemedButton } from '@/components/themed';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/hooks/cart';
import { useCurrency } from '@/hooks/use-currency';
import { useMerchant } from '@/hooks/use-merchant';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/event-tracking';
import { getEffectiveStock } from '@/lib/product-stock';
import type { Product, ProductVariant } from '@/lib/products';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { FAQItem } from '@/types/faq';

// Placeholder image for products without images
const PLACEHOLDER_IMAGE = '/placeholder.svg';

const VALID_CONDITIONS = new Set(['new', 'used', 'open_box', 'refurbished']);

// Lazy load heavy components to reduce initial bundle size
// Lazy load heavy components to reduce initial bundle size
const ReviewsSection = dynamic(
  () =>
    import('@/components/storefront/reviews-section').then(
      (mod) => mod.ReviewsSection
    ),
  {
    loading: () => <Skeleton className="h-[400px] w-full rounded-xl" />,
  }
);

// Koray-aligned semantic product sections
const BrandProducts = dynamic(
  () =>
    import('@/components/storefront/brand-products').then(
      (mod) => mod.BrandProducts
    ),
  {
    loading: () => <Skeleton className="h-[300px] w-full rounded-xl" />,
  }
);

const PriceRangeProducts = dynamic(
  () =>
    import('@/components/storefront/price-range-products').then(
      (mod) => mod.PriceRangeProducts
    ),
  {
    loading: () => <Skeleton className="h-[300px] w-full rounded-xl" />,
  }
);

const RecentlyViewedProducts = dynamic(
  () =>
    import('@/components/storefront/recently-viewed').then(
      (mod) => mod.RecentlyViewedProducts
    ),
  {
    loading: () => <Skeleton className="h-[300px] w-full rounded-xl" />,
  }
);

/**
 * Extract unique attribute types and their values from variants
 */
function getAttributeOptions(
  variants: ProductVariant[]
): { key: string; values: string[] }[] {
  const attributeMap = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const [key, value] of Object.entries(variant.attributes)) {
      if (!attributeMap.has(key)) {
        attributeMap.set(key, new Set());
      }
      attributeMap.get(key)?.add(value);
    }
  }

  return Array.from(attributeMap.entries()).map(([key, values]) => ({
    key,
    values: Array.from(values).sort(),
  }));
}

/**
 * Check if a variant with given attributes exists and has stock
 */
function isVariantAvailable(
  variants: ProductVariant[],
  partialAttributes: Record<string, string>,
  isStockManaged: boolean,
  fallbackStock: number
): boolean {
  if (!isStockManaged) {
    return variants.some((variant) =>
      Object.entries(partialAttributes).every(
        ([key, value]) => variant.attributes[key] === value
      )
    );
  }

  return variants.some((variant) => {
    const matches = Object.entries(partialAttributes).every(
      ([key, value]) => variant.attributes[key] === value
    );
    return (
      matches &&
      getEffectiveStock({
        stock: variant.stock_quantity ?? fallbackStock,
        stock_quantity: variant.stock_quantity ?? fallbackStock,
      }) > 0
    );
  });
}

export default function ProductDetailClient({
  product,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: Reserved for future FAQ section implementation
  faqs,
}: {
  product: Product;
  faqs?: FAQItem[];
}) {
  const { merchant, basePath } = useMerchant();
  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath || ''}${path}`;
  const { cart, addToCart, updateQuantity, setMerchantSlug } = useCart();
  const { toast } = useToast();
  const { formatCurrency, currencyCode } = useCurrency();
  const { addToRecentlyViewed } = useRecentlyViewed();
  const [quantity, setQuantity] = useState(product.minimum_order_quantity || 1);
  const [selectedImage, setSelectedImage] = useState(
    product.imageLarge || product.image || PLACEHOLDER_IMAGE
  );

  // Variant selection state
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null
  );
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});

  // Condition offer state
  const searchParams = useSearchParams();
  const conditionParam = searchParams.get('condition');
  const [selectedCondition, setSelectedCondition] = useState(
    conditionParam && VALID_CONDITIONS.has(conditionParam)
      ? conditionParam
      : product.condition || 'new'
  );

  // Sync selectedCondition when URL param changes (back/forward navigation)
  useEffect(() => {
    if (conditionParam && VALID_CONDITIONS.has(conditionParam)) {
      setSelectedCondition(conditionParam);
    }
  }, [conditionParam]);

  const selectedOffer =
    selectedCondition !== (product.condition || 'new')
      ? product.offers?.find(
          (o: { condition: string }) => o.condition === selectedCondition
        )
      : null;
  const conditionLabels: Record<string, string> = {
    new: 'New',
    used: 'Premium Used',
    open_box: 'Open Box',
    refurbished: 'Refurbished',
  };
  const conditionDescriptions: Record<string, string> = {
    new: 'Factory sealed with full manufacturer warranty',
    open_box: 'Opened but unused, all accessories included',
    used: 'Fully tested and inspected, 30-day warranty',
    refurbished: 'Professionally refurbished to like-new condition',
  };

  // Initialize variant selection - use product.id to prevent re-running on reference changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally using product.id only to prevent re-initialization on object reference changes
  useEffect(() => {
    if (
      product?.has_variants &&
      product.variants &&
      product.variants.length > 0
    ) {
      const firstVariant = product.variants[0];
      setSelectedVariant(firstVariant);
      setSelectedAttributes(firstVariant.attributes);
      if (firstVariant.primary_image) {
        setSelectedImage(firstVariant.primary_image);
      }
    }
  }, [product?.id]);

  // Track product view for recently viewed and analytics
  // Use product.id instead of product object to prevent duplicate tracking on reference changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally using product.id to prevent duplicate analytics calls on object reference changes
  useEffect(() => {
    if (product?.id) {
      addToRecentlyViewed(product.id);
      // Track product view for merchant analytics
      if (merchant?.id) {
        trackEvent.productView(merchant.id, product, currencyCode);
      }
    }
  }, [product?.id, merchant?.id, currencyCode, addToRecentlyViewed]);

  // Product is guaranteed to exist by server component, but guard against archived status
  // Note: Can't call notFound() after hooks in client components, so we render null
  // The server component already handles the notFound() case for missing products
  if (!product || product.status === 'archived') {
    return null;
  }

  // Get variant options if product has variants
  const attributeOptions = product.has_variants
    ? getAttributeOptions(product.variants || [])
    : [];
  const isStockManaged = product.manage_stock ?? true;

  // Get current price based on condition offer or variant selection
  const currentPrice =
    selectedOffer?.price != null
      ? Number(selectedOffer.price)
      : (selectedVariant?.price_override ?? product.price);
  const currentStock = isStockManaged
    ? getEffectiveStock(
        selectedVariant
          ? {
              stock:
                selectedVariant.stock_quantity ?? product.stock ?? undefined,
              stock_quantity:
                selectedVariant.stock_quantity ?? product.stock ?? undefined,
            }
          : product
      )
    : Number.POSITIVE_INFINITY;
  const isOutOfStock = isStockManaged ? currentStock === 0 : false;

  const handleAttributeChange = (attributeKey: string, value: string) => {
    const newAttributes = { ...selectedAttributes, [attributeKey]: value };
    setSelectedAttributes(newAttributes);

    // Find matching variant
    if (product.variants) {
      const matchingVariant = product.variants.find((v) =>
        Object.entries(newAttributes).every(
          ([key, val]) => v.attributes[key] === val
        )
      );

      if (matchingVariant) {
        setSelectedVariant(matchingVariant);
        if (matchingVariant.primary_image) {
          setSelectedImage(matchingVariant.primary_image);
        }
      } else {
        setSelectedVariant(null);
      }
    }
  };

  const handleAddToCart = () => {
    const productToAdd = selectedVariant
      ? { ...product, price: currentPrice }
      : product;

    // Store merchant slug for checkout
    if (merchant?.slug) {
      setMerchantSlug(merchant.slug);
    }

    addToCart(
      productToAdd,
      quantity,
      selectedVariant
        ? {
            variantId: selectedVariant.id,
            variantAttributes: selectedAttributes,
          }
        : undefined
    );

    // Track add to cart for merchant analytics
    if (merchant?.id) {
      trackEvent.addToCart(merchant.id, productToAdd, quantity, currencyCode);
    }

    const variantInfo = selectedVariant
      ? ` (${Object.values(selectedAttributes).join(', ')})`
      : '';

    toast({
      title: 'Added to cart!',
      description: `${quantity} x ${product.name}${variantInfo} has been added to your cart.`,
    });
  };

  const handleQuantityChange = (newQuantity: number) => {
    const moq = product.minimum_order_quantity || 1;
    if (newQuantity >= moq) {
      setQuantity(newQuantity);
    } else {
      setQuantity(moq);
    }
  };

  // Find cart item matching product and variant
  const cartItem = cart.find((item) => {
    if (selectedVariant) {
      return item.id === product.id && item.variantId === selectedVariant.id;
    }
    return item.id === product.id && !item.variantId;
  });

  // Main render
  return (
    <>
      <div className="flex flex-col min-h-screen">
        {/* Main Content - Layout provided by Global OgabasseyLayout */}
        <main
          id="main-content"
          className="flex-1 container mx-auto py-8 px-4 md:px-6"
        >
          {/* Visual Breadcrumbs */}
          <Breadcrumbs
            items={[
              ...(product.categories?.name || product.category
                ? [
                    {
                      label: product.categories?.name || product.category || '',
                      href: `/?category=${encodeURIComponent(product.categories?.name || product.category || '')}`,
                    },
                  ]
                : []),
              { label: product.name },
            ]}
            separator="chevron"
            className="max-w-4xl mx-auto mb-4"
          />

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg overflow-hidden aspect-square relative border border-border/50">
                <Image
                  src={selectedImage || PLACEHOLDER_IMAGE}
                  alt={product.name}
                  data-ai-hint={product.imageHint}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                  className="object-cover"
                />
              </div>
              {product.images && product.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImage(product.imageLarge || product.image)
                    }
                    className={cn(
                      'relative w-20 h-20 rounded-md overflow-hidden border-2 flex-shrink-0',
                      selectedImage === (product.imageLarge || product.image)
                        ? 'border-primary'
                        : 'border-transparent'
                    )}
                  >
                    <Image
                      src={
                        product.imageLarge || product.image || PLACEHOLDER_IMAGE
                      }
                      alt={`${product.name} - Main image`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                  {product.images
                    .filter((img) => img.url)
                    .map((img, idx) => (
                      <button
                        key={img.url || `img-${idx}`}
                        type="button"
                        onClick={() => setSelectedImage(img.url)}
                        className={cn(
                          'relative w-20 h-20 rounded-md overflow-hidden border-2 flex-shrink-0',
                          selectedImage === img.url
                            ? 'border-primary'
                            : 'border-transparent'
                        )}
                      >
                        <Image
                          src={img.url}
                          alt={img.alt || `Product image ${idx + 1}`}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center space-y-6 py-4">
              <div>
                <h1
                  className="text-3xl lg:text-4xl font-bold font-headline"
                  style={{ color: 'var(--store-primary)' }}
                >
                  {product.name}
                </h1>

                {/* SKU / MPN Display */}
                {(product.sku || product.mpn) && (
                  <p className="text-sm text-muted-foreground mt-1">
                    SKU: {product.sku || product.mpn}
                  </p>
                )}

                {product.fulfillmentFields &&
                  product.fulfillmentFields.length > 0 && (
                    <div className="text-sm text-gray-500 mt-2">
                      <p className="font-medium">Requires:</p>
                      <ul className="list-disc list-inside">
                        {product.fulfillmentFields.map((field) => (
                          <li key={field.name}>{field.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="flex items-baseline gap-3 mt-2">
                  <p
                    className="text-3xl font-bold"
                    style={{ color: 'var(--store-secondary)' }}
                  >
                    {formatCurrency(currentPrice)}
                  </p>
                  {product.compare_at_price &&
                    product.compare_at_price > currentPrice && (
                      <p className="text-lg text-muted-foreground line-through decoration-red-500/50">
                        {formatCurrency(product.compare_at_price)}
                      </p>
                    )}
                </div>
              </div>

              <div className="prose prose-sm text-muted-foreground text-lg leading-relaxed">
                <p>{product.description}</p>
              </div>

              {/* Condition Selector */}
              {product.has_condition_offers &&
              product.offers &&
              product.offers.length > 0 ? (
                <div className="space-y-3">
                  <Label className="text-sm font-medium block">
                    Condition:{' '}
                    <span style={{ color: 'var(--store-primary)' }}>
                      {conditionLabels[selectedCondition] || selectedCondition}
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCondition(product.condition || 'new')
                      }
                      className={cn(
                        'rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all',
                        selectedCondition === (product.condition || 'new')
                          ? 'border-[var(--store-primary)] text-[var(--store-primary)] bg-[var(--store-primary)]/5'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      {conditionLabels[product.condition || 'new'] || 'New'}
                    </button>
                    {product.offers.map(
                      (offer: { id: string; condition: string }) => (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() => setSelectedCondition(offer.condition)}
                          className={cn(
                            'rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all',
                            selectedCondition === offer.condition
                              ? 'border-[var(--store-primary)] text-[var(--store-primary)] bg-[var(--store-primary)]/5'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          )}
                        >
                          {conditionLabels[offer.condition] || offer.condition}
                        </button>
                      )
                    )}
                  </div>
                  {selectedOffer && selectedOffer.price != null && (
                    <p className="text-sm font-medium text-green-600">
                      Save{' '}
                      {formatCurrency(
                        product.price - Number(selectedOffer.price)
                      )}{' '}
                      vs New
                    </p>
                  )}
                  {conditionDescriptions[selectedCondition] && (
                    <p className="text-xs text-muted-foreground">
                      {conditionDescriptions[selectedCondition]}
                    </p>
                  )}
                </div>
              ) : product.condition && product.condition !== 'new' ? (
                <p className="text-sm">
                  <strong>Condition:</strong>{' '}
                  <span className="capitalize">{product.condition}</span>
                  {product.condition_detail && ` - ${product.condition_detail}`}
                </p>
              ) : null}

              {/* Variant Selection */}
              {product.has_variants && attributeOptions.length > 0 && (
                <div className="space-y-4">
                  {attributeOptions.map(({ key, values }) => (
                    <div key={key}>
                      <Label className="text-sm font-medium mb-2 block capitalize">
                        {key}:{' '}
                        <span className="font-normal">
                          {selectedAttributes[key]}
                        </span>
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value) => {
                          const isSelected = selectedAttributes[key] === value;
                          const isAvailable = isVariantAvailable(
                            product.variants || [],
                            { ...selectedAttributes, [key]: value },
                            isStockManaged,
                            getEffectiveStock(product)
                          );

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleAttributeChange(key, value)}
                              disabled={!isAvailable}
                              className={cn(
                                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                                isSelected
                                  ? 'bg-[var(--store-primary)] text-[var(--store-primary-text)] ring-2 ring-[var(--store-primary)] ring-offset-2'
                                  : isAvailable
                                    ? 'bg-muted hover:bg-muted/80'
                                    : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed line-through'
                              )}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 inline mr-1" />
                              )}
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                {isOutOfStock ? (
                  <ThemedBadge colorRole="primary" variant="destructive">
                    Out of Stock
                  </ThemedBadge>
                ) : (
                  <ThemedBadge colorRole="primary" variant="outline">
                    {isStockManaged ? 'In Stock' : 'Unlimited stock'}
                  </ThemedBadge>
                )}
                {isStockManaged ? (
                  currentStock > 0 ? (
                    <p
                      className={cn(
                        'text-sm mt-2',
                        currentStock <= (product.low_stock_threshold || 5)
                          ? 'text-amber-600 font-medium'
                          : 'text-muted-foreground'
                      )}
                    >
                      {currentStock} units available
                      {currentStock <= (product.low_stock_threshold || 5) &&
                        ' (Low Stock)'}
                    </p>
                  ) : null
                ) : (
                  <p className="text-sm mt-2 text-muted-foreground">
                    Unlimited stock available
                  </p>
                )}
              </div>

              {product.minimum_order_quantity &&
                product.minimum_order_quantity > 1 && (
                  <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                      Minimum order quantity:{' '}
                      <strong>{product.minimum_order_quantity} units</strong>
                    </AlertDescription>
                  </Alert>
                )}

              <div className="flex flex-col gap-2">
                {cartItem ? (
                  <div className="flex flex-col gap-2">
                    {selectedVariant && (
                      <p className="text-sm text-muted-foreground">
                        Selected:{' '}
                        {Object.values(cartItem.variantAttributes || {}).join(
                          ', '
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <ThemedButton
                        colorRole="accent"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10"
                        onClick={() =>
                          updateQuantity(
                            product.id,
                            cartItem.quantity - 1,
                            selectedVariant?.id
                          )
                        }
                        aria-label={`Decrease quantity of ${product.name}`}
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </ThemedButton>
                      <Input
                        type="number"
                        value={cartItem.quantity}
                        onChange={(e) =>
                          updateQuantity(
                            product.id,
                            Math.max(
                              Number.parseInt(e.target.value, 10) ||
                                product.minimum_order_quantity ||
                                1,
                              product.minimum_order_quantity || 1
                            ),
                            selectedVariant?.id
                          )
                        }
                        className="h-10 w-16 text-center text-base remove-arrow"
                        min={product.minimum_order_quantity || 1}
                        aria-label={`Quantity for ${product.name}`}
                      />
                      <ThemedButton
                        colorRole="accent"
                        size="icon"
                        variant="default"
                        className="h-10 w-10"
                        onClick={() =>
                          updateQuantity(
                            product.id,
                            cartItem.quantity + 1,
                            selectedVariant?.id
                          )
                        }
                        aria-label={`Increase quantity of ${product.name}`}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </ThemedButton>
                    </div>
                    <Link href={asRoute(getHref('/checkout'))}>
                      <ThemedButton
                        size="lg"
                        colorRole="primary"
                        className="w-full"
                      >
                        View Cart and Checkout
                      </ThemedButton>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1">
                      <ThemedButton
                        colorRole="accent"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10"
                        onClick={() => handleQuantityChange(quantity - 1)}
                        aria-label={`Decrease quantity of ${product.name}`}
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </ThemedButton>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) =>
                          handleQuantityChange(
                            Number.parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="h-10 w-16 text-center text-base remove-arrow"
                        min={product.minimum_order_quantity || 1}
                        aria-label={`Quantity for ${product.name}`}
                      />
                      <ThemedButton
                        colorRole="accent"
                        size="icon"
                        variant="default"
                        className="h-10 w-10"
                        onClick={() => handleQuantityChange(quantity + 1)}
                        aria-label={`Increase quantity of ${product.name}`}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </ThemedButton>
                    </div>
                    <ThemedButton
                      size="lg"
                      colorRole="primary"
                      className="w-full"
                      disabled={
                        isOutOfStock ||
                        (product.has_variants && !selectedVariant)
                      }
                      onClick={handleAddToCart}
                    >
                      Add to Cart
                    </ThemedButton>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Reviews */}
          <ReviewsSection
            productId={product.id}
            productName={product.name}
            className="mt-8 border-t pt-8 max-w-4xl mx-auto"
          />

          {/* Koray-aligned semantic sections: Same brand, same category */}
          <BrandProducts
            product={product}
            maxProducts={4}
            className="mt-8 border-t"
          />

          {/* Koray-aligned semantic sections: Same category, similar price */}
          <PriceRangeProducts
            product={product}
            maxProducts={4}
            className="border-t"
          />

          {/* Recently Viewed Products - User convenience only, no SEO value */}
          <div data-nosnippet>
            <RecentlyViewedProducts
              excludeProductId={product.id}
              maxProducts={6}
              className="border-t"
            />
          </div>
        </main>
      </div>

      {/* Sticky Add-to-Cart (Mobile) */}
      <StickyAddToCart
        product={product}
        selectedVariant={selectedVariant}
        selectedAttributes={selectedAttributes}
      />
    </>
  );
}
