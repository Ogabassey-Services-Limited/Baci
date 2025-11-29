'use client';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { useCurrency } from '@/hooks/use-currency';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft, Plus, Minus, Info, Check } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductVariant } from '@/lib/products';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { ThemedButton, ThemedBadge } from '@/components/themed';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findDarkestColor, getContrastingTextColor } from '@/lib/color-utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { RecentlyViewedProducts } from '@/components/storefront/recently-viewed';
import { RelatedProducts } from '@/components/storefront/related-products';
import { StickyAddToCart } from '@/components/storefront/sticky-add-to-cart';
import { Breadcrumbs } from '@/components/storefront/breadcrumbs';
import { ReviewsSection } from '@/components/storefront/reviews-section';
import { trackEvent } from '@/lib/event-tracking';

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
            attributeMap.get(key)!.add(value);
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
    partialAttributes: Record<string, string>
): boolean {
    return variants.some((variant) => {
        const matches = Object.entries(partialAttributes).every(
            ([key, value]) => variant.attributes[key] === value
        );
        return matches && variant.stock_quantity > 0;
    });
}

export default function ProductDetailClient({ product }: { product: Product }) {
    const { merchant } = useMerchant();
    const { cart, cartCount, addToCart, updateQuantity } = useCart();
    const { toast } = useToast();
    const { formatCurrency, currencyCode } = useCurrency();
    const { addToRecentlyViewed } = useRecentlyViewed();
    const [quantity, setQuantity] = useState(product.minimum_order_quantity || 1);
    const [selectedImage, setSelectedImage] = useState(product.imageLarge || product.image);

    // Variant selection state
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

    // Initialize variant selection
    useEffect(() => {
        if (product?.has_variants && product.variants && product.variants.length > 0) {
            const firstVariant = product.variants[0];
            setSelectedVariant(firstVariant);
            setSelectedAttributes(firstVariant.attributes);
            if (firstVariant.primary_image) {
                setSelectedImage(firstVariant.primary_image);
            }
        }
    }, [product]);

    // Track product view for recently viewed and analytics
    useEffect(() => {
        if (product?.id) {
            addToRecentlyViewed(product.id);
            // Track product view for merchant analytics
            if (merchant?.id) {
                trackEvent.productView(merchant.id, product, currencyCode);
            }
        }
    }, [product, merchant?.id, currencyCode, addToRecentlyViewed]);

    if (!product || product.status === 'archived') {
        notFound();
    }

    // Get variant options if product has variants
    const attributeOptions = product.has_variants ? getAttributeOptions(product.variants || []) : [];

    // Get current price and stock based on variant selection
    const currentPrice = selectedVariant?.price_override ?? product.price;
    const currentStock = selectedVariant?.stock_quantity ?? product.stock;
    const isOutOfStock = product.manage_stock && currentStock === 0;

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

        addToCart(productToAdd, quantity, selectedVariant ? {
            variantId: selectedVariant.id,
            variantAttributes: selectedAttributes
        } : undefined);

        // Track add to cart for merchant analytics
        if (merchant?.id) {
            trackEvent.addToCart(merchant.id, productToAdd, quantity, currencyCode);
        }

        const variantInfo = selectedVariant
            ? ` (${Object.values(selectedAttributes).join(', ')})`
            : '';

        toast({
            title: "Added to cart!",
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

    const storeName = merchant?.business_name || 'Baci Store';

    const footerLinks = [
        { key: 'about', label: 'About Us' },
        { key: 'contact', label: 'Contact' },
        { key: 'privacy', label: 'Privacy Policy' },
        { key: 'terms', label: 'Terms and Conditions' },
        { key: 'faq', label: 'FAQs' },
        { key: 'legal', label: 'Legal and Dispute' },
    ];

    const availableFooterLinks = footerLinks.filter(link => merchant?.pages?.[link.key as keyof typeof merchant.pages]);

    // Find cart item matching product and variant
    const cartItem = cart.find(item => {
        if (selectedVariant) {
            return item.id === product.id && item.variantId === selectedVariant.id;
        }
        return item.id === product.id && !item.variantId;
    });

    const brandColors = merchant?.brand_colors ? [merchant.brand_colors.primary, merchant.brand_colors.background, merchant.brand_colors.accent].filter(Boolean) : ['#3F51B5'];
    const darkestColor = findDarkestColor(brandColors as string[]);

    return (
        <>
            {/* Skip link for keyboard navigation */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
                Skip to main content
            </a>
            <div className="flex flex-col min-h-screen">
                <Sheet>
                    <header
                        className="glass-themed px-4 lg:px-6 h-16 flex items-center justify-between sticky top-0 z-10"
                        style={{
                            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                            paddingRight: 'max(1rem, env(safe-area-inset-right))',
                        }}
                    >
                        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
                            <ArrowLeft className="w-5 h-5" />
                            Back to Store
                        </Link>
                        <nav className="flex items-center gap-4 sm:gap-6">
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <ShoppingBag className="w-6 h-6" />
                                    {cartCount > 0 && <ThemedBadge colorRole="accent" className="absolute -top-1 -right-1 h-5 w-5 text-xs justify-center rounded-full p-0">{cartCount}</ThemedBadge>}
                                    <span className="sr-only">Cart</span>
                                </Button>
                            </SheetTrigger>
                        </nav>
                    </header>

                    <main id="main-content" className="flex-1 container mx-auto py-8 px-4 md:px-6">
                        {/* Visual Breadcrumbs */}
                        <Breadcrumbs
                            items={[
                                ...(product.category ? [{ label: product.category, href: `/?category=${encodeURIComponent(product.category)}` }] : []),
                                { label: product.name }
                            ]}
                            separator="chevron"
                            className="max-w-4xl mx-auto mb-4"
                        />

                        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">
                            {/* Image Gallery */}
                            <div className="space-y-4">
                                <div className="bg-muted/50 rounded-lg overflow-hidden aspect-square relative border border-border/50">
                                    <Image
                                        src={selectedImage}
                                        alt={product.name}
                                        data-ai-hint={product.imageHint}
                                        fill
                                        priority
                                        className="object-cover"
                                    />
                                </div>
                                {product.images && product.images.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedImage(product.imageLarge || product.image)}
                                            className={cn(
                                                "relative w-20 h-20 rounded-md overflow-hidden border-2 flex-shrink-0",
                                                selectedImage === (product.imageLarge || product.image) ? "border-primary" : "border-transparent"
                                            )}
                                        >
                                            <Image src={product.imageLarge || product.image} alt={`${product.name} - Main image`} fill className="object-cover" />
                                        </button>
                                        {product.images.map((img, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setSelectedImage(img.url)}
                                                className={cn(
                                                    "relative w-20 h-20 rounded-md overflow-hidden border-2 flex-shrink-0",
                                                    selectedImage === img.url ? "border-primary" : "border-transparent"
                                                )}
                                            >
                                                <Image src={img.url} alt={img.alt || `Product image ${idx + 1}`} fill className="object-cover" />
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

                                    {product.fulfillmentFields && product.fulfillmentFields.length > 0 && (
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
                                        {product.compare_at_price && product.compare_at_price > currentPrice && (
                                            <p className="text-lg text-muted-foreground line-through decoration-red-500/50">
                                                {formatCurrency(product.compare_at_price)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="prose prose-sm text-muted-foreground text-lg leading-relaxed">
                                    <p>{product.description}</p>
                                    {product.condition && product.condition !== 'new' && (
                                        <p className="mt-2 text-sm">
                                            <strong>Condition:</strong> <span className="capitalize">{product.condition}</span>
                                            {product.condition_detail && ` - ${product.condition_detail}`}
                                        </p>
                                    )}
                                </div>

                                {/* Variant Selection */}
                                {product.has_variants && attributeOptions.length > 0 && (
                                    <div className="space-y-4">
                                        {attributeOptions.map(({ key, values }) => (
                                            <div key={key}>
                                                <Label className="text-sm font-medium mb-2 block capitalize">
                                                    {key}: <span className="font-normal">{selectedAttributes[key]}</span>
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {values.map((value) => {
                                                        const isSelected = selectedAttributes[key] === value;
                                                        const isAvailable = isVariantAvailable(
                                                            product.variants || [],
                                                            { ...selectedAttributes, [key]: value }
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
                                                                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
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
                                        <ThemedBadge colorRole="primary" variant="destructive">Out of Stock</ThemedBadge>
                                    ) : (
                                        <ThemedBadge colorRole="primary" variant="outline">In Stock</ThemedBadge>
                                    )}
                                    {product.manage_stock && currentStock > 0 && (
                                        <p className={cn("text-sm mt-2", currentStock <= (product.low_stock_threshold || 5) ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                                            {currentStock} units available
                                            {currentStock <= (product.low_stock_threshold || 5) && " (Low Stock)"}
                                        </p>
                                    )}
                                </div>

                                {product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                                    <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                                        <Info className="h-4 w-4 text-blue-600" />
                                        <AlertDescription>
                                            Minimum order quantity: <strong>{product.minimum_order_quantity} units</strong>
                                        </AlertDescription>
                                    </Alert>
                                )}


                                <div className="flex flex-col gap-2">
                                    {cartItem ? (
                                        <div className="flex flex-col gap-2">
                                            {selectedVariant && (
                                                <p className="text-sm text-muted-foreground">
                                                    Selected: {Object.values(cartItem.variantAttributes || {}).join(', ')}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <ThemedButton colorRole="accent" size="icon" variant="outline" className="h-10 w-10" onClick={() => updateQuantity(product.id, cartItem.quantity - 1, selectedVariant?.id)} aria-label={`Decrease quantity of ${product.name}`}>
                                                    <Minus className="h-4 w-4" aria-hidden="true" />
                                                </ThemedButton>
                                                <Input
                                                    type="number"
                                                    value={cartItem.quantity}
                                                    onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 0, selectedVariant?.id)}
                                                    className="h-10 w-16 text-center text-base remove-arrow"
                                                    min="0"
                                                    aria-label={`Quantity for ${product.name}`}
                                                />
                                                <ThemedButton colorRole="accent" size="icon" variant="default" className="h-10 w-10" onClick={() => updateQuantity(product.id, cartItem.quantity + 1, selectedVariant?.id)} aria-label={`Increase quantity of ${product.name}`}>
                                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                                </ThemedButton>
                                            </div>
                                            <Link href="/checkout">
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
                                                <ThemedButton colorRole="accent" size="icon" variant="outline" className="h-10 w-10" onClick={() => handleQuantityChange(quantity - 1)} aria-label={`Decrease quantity of ${product.name}`}>
                                                    <Minus className="h-4 w-4" aria-hidden="true" />
                                                </ThemedButton>
                                                <Input
                                                    type="number"
                                                    value={quantity}
                                                    onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 0)}
                                                    className="h-10 w-16 text-center text-base remove-arrow"
                                                    min={product.minimum_order_quantity || 1}
                                                    aria-label={`Quantity for ${product.name}`}
                                                />
                                                <ThemedButton colorRole="accent" size="icon" variant="default" className="h-10 w-10" onClick={() => handleQuantityChange(quantity + 1)} aria-label={`Increase quantity of ${product.name}`}>
                                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                                </ThemedButton>
                                            </div>
                                            <ThemedButton
                                                size="lg"
                                                colorRole="primary"
                                                className="w-full"
                                                disabled={isOutOfStock || (product.has_variants && !selectedVariant)}
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

                        {/* Related Products */}
                        <RelatedProducts
                            product={product}
                            maxProducts={4}
                            className="mt-8 border-t"
                        />

                        {/* Recently Viewed Products */}
                        <RecentlyViewedProducts
                            excludeProductId={product.id}
                            maxProducts={6}
                            className="border-t"
                        />
                    </main>

                    <footer
                        className="text-white"
                        style={{ backgroundColor: darkestColor, color: getContrastingTextColor(darkestColor) }}
                    >
                        <div
                            className="container mx-auto py-8 px-4 md:px-6"
                            style={{
                                paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                                paddingRight: 'max(1rem, env(safe-area-inset-right))',
                            }}
                        >
                            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">{storeName}</h3>
                                    <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</p>
                                </div>
                                {availableFooterLinks.length > 0 && (
                                    <div className="lg:col-span-2">
                                        <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                                        <nav className="grid grid-cols-2 gap-2">
                                            {availableFooterLinks.map((link) => (
                                                <Link key={link.key} className="text-sm hover:underline underline-offset-4 opacity-80 hover:opacity-100" href={`/pages/${link.key}`}>
                                                    {link.label}
                                                </Link>
                                            ))}
                                        </nav>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                                    <div className="flex space-x-4">
                                        {/* Social links can be added here */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </footer>
                    <Cart />
                </Sheet>

                {/* Sticky Add-to-Cart (Mobile) */}
                <StickyAddToCart
                    product={product}
                    selectedVariant={selectedVariant}
                    selectedAttributes={selectedAttributes}
                />
            </div>
        </>
    );
}
