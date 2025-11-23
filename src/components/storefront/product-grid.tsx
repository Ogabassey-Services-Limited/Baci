'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/lib/products';
import { apiGet } from '@/lib/api-client';
import Fuse from 'fuse.js';
import { Loader2, Minus, Plus } from 'lucide-react';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';
import { getCountryByCode } from '@/lib/countries';
import { useStorefront } from '@/contexts/storefront-context';
import { findDarkestColor } from '@/lib/color-utils';

interface StorefrontProductGridProps {
    title?: string;
    columns?: number;
    limit?: number;
}

export function StorefrontProductGrid({ title = 'Our Products', columns = 4, limit = 12 }: StorefrontProductGridProps) {
    const { merchant } = useMerchant();
    const { cart, addToCart, updateQuantity } = useCart();
    const { toast } = useToast();
    const { searchQuery, selectedCategory, setSelectedCategory } = useStorefront();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (merchant?.id) {
            apiGet<{ products: Product[] }>(`/api/storefront/products?merchant_id=${merchant.id}`)
                .then((data) => {
                    if (data.products) {
                        setProducts(data.products);
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setIsLoading(false);
                });
        }
    }, [merchant?.id]);

    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category || 'General'));
        return ['All', ...Array.from(cats)];
    }, [products]);

    const fuse = useMemo(() => {
        if (products.length > 0) {
            return new Fuse(products, {
                keys: ['name', 'description', 'brand'],
                includeScore: true,
                threshold: 0.4,
            });
        }
        return null;
    }, [products]);

    const searchResults = useMemo(() => {
        let filtered = products;

        if (searchQuery && fuse) {
            filtered = fuse.search(searchQuery).map(result => result.item);
        }

        if (selectedCategory !== 'All') {
            filtered = filtered.filter(p => (p.category || 'General') === selectedCategory);
        }

        return filtered.filter(p => p.status === 'published').slice(0, limit);
    }, [searchQuery, fuse, products, selectedCategory, limit]);

    const handleAddToCart = (product: Product) => {
        addToCart(product);
        toast({
            title: "Added to cart!",
            description: `${product.name} has been added to your cart.`,
        });
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

    const brandColors = merchant?.brand_colors ? [merchant.brand_colors.primary, merchant.brand_colors.background, merchant.brand_colors.accent].filter(Boolean) : ['#3F51B5'];
    const darkestColor = findDarkestColor(brandColors as string[]);

    if (!merchant) return null;

    return (
        <section className="w-full py-12 md:py-24 lg:py-32" id="products">
            <div className="container px-4 md:px-6">
                <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl text-center mb-10" style={{ color: darkestColor }}>{title}</h2>

                {categories.length > 1 && (
                    <div className="flex justify-center gap-2 mb-8 flex-wrap">
                        {categories.map(category => (
                            <ThemedButton
                                key={category}
                                variant={selectedCategory === category ? 'default' : 'outline'}
                                colorRole={selectedCategory === category ? 'primary' : 'accent'}
                                onClick={() => setSelectedCategory(category)}
                                size="sm"
                                className="capitalize"
                            >
                                {category}
                            </ThemedButton>
                        ))}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : searchResults.length > 0 ? (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${columns} gap-6`}>
                        {searchResults.map((product, index) => {
                            const cartItem = cart.find(item => item.id === product.id);

                            return (
                                <ThemedCard key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col" accentPosition="top">
                                    <Link href={`/product/${product.id}`} className="block">
                                        <Image
                                            src={product.imageLarge}
                                            alt={product.name}
                                            data-ai-hint={product.imageHint}
                                            width={600}
                                            height={400}
                                            className="object-cover w-full h-auto aspect-video"
                                        />
                                    </Link>
                                    <CardContent className="p-4 flex flex-col flex-1">
                                        <h3 className="font-semibold text-lg">{product.name}</h3>
                                        <p className="text-muted-foreground text-sm mt-1 truncate flex-1">{product.description}</p>
                                        <div className="flex items-center justify-between mt-4">
                                            <p className="text-lg font-bold" style={{ color: 'var(--store-primary)' }}>{formatCurrency(product.price)}</p>
                                            {cartItem ? (
                                                <div className="flex items-center gap-1">
                                                    <ThemedButton colorRole="accent" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>
                                                        <Minus className="h-4 w-4" />
                                                    </ThemedButton>
                                                    <Input
                                                        type="number"
                                                        value={cartItem.quantity}
                                                        onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 0)}
                                                        className="h-8 w-12 text-center remove-arrow"
                                                        min="0"
                                                    />
                                                    <ThemedButton colorRole="accent" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>
                                                        <Plus className="h-4 w-4" />
                                                    </ThemedButton>
                                                </div>
                                            ) : (
                                                <ThemedButton colorRole="primary" size="sm" onClick={() => handleAddToCart(product)}>
                                                    Add to Cart
                                                </ThemedButton>
                                            )}
                                        </div>
                                    </CardContent>
                                </ThemedCard>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <h3 className="text-xl font-semibold">No products found</h3>
                        <p>Your search for "{searchQuery}" did not match any products.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
