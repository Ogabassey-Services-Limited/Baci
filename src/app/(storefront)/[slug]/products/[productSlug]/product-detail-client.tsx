'use client';

import { notFound } from 'next/navigation';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft, Plus, Minus, Info } from 'lucide-react';
import React, { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/lib/products';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { ThemedButton, ThemedBadge } from '@/components/themed';
import { Input } from '@/components/ui/input';
import { findDarkestColor, getContrastingTextColor } from '@/lib/color-utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function ProductDetailClient({ product }: { product: Product }) {
    const { merchant } = useMerchant();
    const { cart, cartCount, addToCart, updateQuantity } = useCart();
    const { toast } = useToast();
    const [quantity, setQuantity] = useState(product.minimum_order_quantity || 1);
    const [selectedImage, setSelectedImage] = useState(product.imageLarge || product.image);

    if (!product || product.status === 'archived') {
        notFound();
    }

    const handleAddToCart = (product: Product) => {
        addToCart(product, quantity);
        toast({
            title: "Added to cart!",
            description: `${quantity} x ${product.name} has been added to your cart.`,
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

    const cartItem = cart.find(item => item.id === product.id);

    const brandColors = merchant?.brand_colors ? [merchant.brand_colors.primary, merchant.brand_colors.background, merchant.brand_colors.accent].filter(Boolean) : ['#3F51B5'];
    const darkestColor = findDarkestColor(brandColors as string[]);

    // JSON-LD Structured Data
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: product.images?.map(img => img.url) || [product.imageLarge],
        description: product.description,
        brand: {
            '@type': 'Brand',
            name: product.brand,
        },
        sku: product.sku || product.mpn,
        mpn: product.mpn,
        gtin: product.gtin,
        offers: {
            '@type': 'Offer',
            url: typeof window !== 'undefined' ? window.location.href : '',
            priceCurrency: merchant?.country ? getCountryByCode(merchant.country)?.currency || 'USD' : 'USD',
            price: product.price,
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: {
                '@type': 'Organization',
                name: storeName,
            },
        },
    };

    return (
        <div className="flex flex-col min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            <Sheet>
                <header className="px-4 lg:px-6 h-16 flex items-center justify-between shadow-sm sticky top-0 bg-background/80 backdrop-blur-sm z-10">
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

                <main className="flex-1 container mx-auto py-12 px-4 md:px-6">
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
                                        onClick={() => setSelectedImage(product.imageLarge || product.image)}
                                        className={cn(
                                            "relative w-20 h-20 rounded-md overflow-hidden border-2 flex-shrink-0",
                                            selectedImage === (product.imageLarge || product.image) ? "border-primary" : "border-transparent"
                                        )}
                                    >
                                        <Image src={product.imageLarge || product.image} alt="Main" fill className="object-cover" />
                                    </button>
                                    {product.images.map((img, idx) => (
                                        <button
                                            key={idx}
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
                                        {formatCurrency(product.price)}
                                    </p>
                                    {product.compare_at_price && product.compare_at_price > product.price && (
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

                            <div>
                                {product.stock > 0 ? (
                                    <ThemedBadge colorRole="primary" variant="outline">In Stock</ThemedBadge>
                                ) : (
                                    <ThemedBadge colorRole="primary" variant="destructive">Out of Stock</ThemedBadge>
                                )}
                                {product.manage_stock && (
                                    <p className={cn("text-sm mt-2", product.stock <= (product.low_stock_threshold || 5) ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                                        {product.stock} units available
                                        {product.stock <= (product.low_stock_threshold || 5) && " (Low Stock)"}
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
                                        <div className="flex items-center gap-2">
                                            <ThemedButton colorRole="accent" size="icon" variant="outline" className="h-10 w-10" onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>
                                                <Minus className="h-4 w-4" />
                                            </ThemedButton>
                                            <Input
                                                type="number"
                                                value={cartItem.quantity}
                                                onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 0)}
                                                className="h-10 w-16 text-center text-base remove-arrow"
                                                min="0"
                                            />
                                            <ThemedButton colorRole="accent" size="icon" variant="default" className="h-10 w-10" onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>
                                                <Plus className="h-4 w-4" />
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
                                            <ThemedButton colorRole="accent" size="icon" variant="outline" className="h-10 w-10" onClick={() => handleQuantityChange(quantity - 1)}>
                                                <Minus className="h-4 w-4" />
                                            </ThemedButton>
                                            <Input
                                                type="number"
                                                value={quantity}
                                                onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 0)}
                                                className="h-10 w-16 text-center text-base remove-arrow"
                                                min={product.minimum_order_quantity || 1}
                                            />
                                            <ThemedButton colorRole="accent" size="icon" variant="default" className="h-10 w-10" onClick={() => handleQuantityChange(quantity + 1)}>
                                                <Plus className="h-4 w-4" />
                                            </ThemedButton>
                                        </div>
                                        <ThemedButton
                                            size="lg"
                                            colorRole="primary"
                                            className="w-full"
                                            disabled={product.stock === 0}
                                            onClick={() => handleAddToCart(product)}
                                        >
                                            Add to Cart
                                        </ThemedButton>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                <footer
                    className="text-white"
                    style={{ backgroundColor: darkestColor, color: getContrastingTextColor(darkestColor) }}
                >
                    <div className="container mx-auto py-8 px-4 md:px-6">
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
        </div>
    );
}
