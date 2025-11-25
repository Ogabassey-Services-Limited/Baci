
'use client';

import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import Link from 'next/link';
import { ShoppingBag, ArrowLeft, Plus, Minus } from 'lucide-react';
import React, { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Product, ProductVariant } from '@/lib/products';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { ThemedButton, ThemedBadge } from '@/components/themed';
import { Input } from '@/components/ui/input';
import { findDarkestColor, getContrastingTextColor } from '@/lib/color-utils';
import { Button } from '@/components/ui/button';

// This is now a dedicated Client Component that receives the product as a prop.
export default function ProductDetailClient({ product }: { product: Product }) {
  const { merchant } = useMerchant();
  const { cart, cartCount, addToCart, updateQuantity } = useCart();
  const { toast } = useToast();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Initialize options when product loads
  React.useEffect(() => {
    if (product.has_variants && product.variants && product.variants.length > 0) {
      const initialOptions: Record<string, string> = {};
      // Get all unique attributes
      const attributes = new Set<string>();
      product.variants.forEach(v => {
        Object.keys(v.attributes).forEach(k => attributes.add(k));
      });

      // Select first available option for each attribute
      attributes.forEach(attr => {
        const options = new Set<string>();
        product.variants?.forEach(v => {
          if (v.attributes[attr]) options.add(v.attributes[attr]);
        });
        const firstOption = Array.from(options)[0];
        if (firstOption) initialOptions[attr] = firstOption;
      });

      setSelectedOptions(initialOptions);
    }
  }, [product]);

  // Update selected variant when options change
  React.useEffect(() => {
    if (!product.has_variants || !product.variants) {
      setSelectedVariant(null);
      return;
    }

    const variant = product.variants.find(v => {
      return Object.entries(selectedOptions).every(([key, value]) => v.attributes[key] === value);
    });

    setSelectedVariant(variant || null);
  }, [selectedOptions, product]);

  const handleOptionChange = (attribute: string, value: string) => {
    setSelectedOptions(prev => ({ ...prev, [attribute]: value }));
  };

  // Get unique attributes and their options
  const variantAttributes = React.useMemo(() => {
    if (!product.has_variants || !product.variants) return {};

    const attrs: Record<string, Set<string>> = {};
    product.variants.forEach(v => {
      Object.entries(v.attributes).forEach(([key, value]) => {
        if (!attrs[key]) attrs[key] = new Set();
        attrs[key].add(value);
      });
    });
    return attrs;
  }, [product]);

  const currentPrice = selectedVariant?.price_override ?? product.price;
  const currentStock = selectedVariant ? (selectedVariant.stock_quantity || 0) : product.stock;
  const currentImage = selectedVariant?.primary_image || product.imageLarge;

  const [quantity, setQuantity] = useState(product.minimum_order_quantity || 1);

  const cartItem = cart.find(item => item.id === (selectedVariant ? selectedVariant.id : product.id));

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

  const handleQuantityChange = (newQuantity: number) => {
    const minQty = product.minimum_order_quantity || 1;
    if (newQuantity < minQty) {
      setQuantity(minQty);
    } else if (newQuantity > currentStock) {
      setQuantity(currentStock);
    } else {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = (product: Product) => {
    if (product.has_variants && !selectedVariant) {
      toast({
        title: "Select Options",
        description: "Please select all options before adding to cart.",
        variant: "destructive"
      });
      return;
    }

    // Create a specialized product object for the cart that includes variant info
    const cartProduct = {
      ...product,
      id: selectedVariant ? selectedVariant.id : product.id, // Use variant ID if selected
      price: currentPrice,
      name: selectedVariant
        ? `${product.name} (${Object.values(selectedVariant.attributes).join(' / ')})`
        : product.name,
      image: currentImage, // Use variant image
      imageLarge: currentImage
    };

    addToCart(cartProduct, quantity);
    toast({
      title: "Added to cart!",
      description: `${quantity} x ${cartProduct.name} has been added to your cart.`,
    });
  };

  // Footer configuration
  const storeName = merchant?.business_name || 'Baci Store';
  const darkestColor = merchant?.brand_colors ? findDarkestColor([merchant.brand_colors.primary, merchant.brand_colors.background, merchant.brand_colors.accent]) : '#000000';
  const availableFooterLinks = Object.entries(merchant?.pages || {})
    .filter(([_, content]) => content && content.trim().length > 0)
    .map(([key, _]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
    }));

  return (
    <Sheet>
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back to Store</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-10 w-10">
                  <ShoppingBag className="w-5 h-5" />
                  {cartCount > 0 && <ThemedBadge colorRole="accent" variant="default" className="absolute -top-1 -right-1 h-5 w-5 text-xs justify-center rounded-full p-0">{cartCount}</ThemedBadge>}
                  <span className="sr-only">Cart</span>
                </Button>
              </SheetTrigger>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto py-12 px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">
            <div className="bg-muted/50 rounded-lg overflow-hidden aspect-square">
              <Image
                src={currentImage}
                alt={product.name}
                data-ai-hint={product.imageHint}
                width={600}
                height={600}
                priority
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center space-y-6 py-4">
              <div>
                <h1
                  className="text-3xl lg:text-4xl font-bold font-headline"
                  style={{ color: 'var(--store-primary)' }}
                >
                  {product.name}
                </h1>
                {/* ... fulfillment fields ... */}
                <p
                  className="text-3xl font-bold mt-2"
                  style={{ color: 'var(--store-secondary)' }}
                >
                  {formatCurrency(currentPrice)}
                </p>
              </div>

              <p className="text-muted-foreground text-lg leading-relaxed">
                {product.description}
              </p>

              {/* Variant Selectors */}
              {product.has_variants && Object.entries(variantAttributes).map(([attr, options]) => (
                <div key={attr} className="space-y-2">
                  <span className="font-medium capitalize">{attr}:</span>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(options).map(option => (
                      <button
                        key={option}
                        onClick={() => handleOptionChange(attr, option)}
                        className={`px-3 py-1 rounded-md border text-sm transition-all ${selectedOptions[attr] === option
                          ? 'bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary/30'
                          : 'bg-background hover:bg-muted'
                          }`}
                        style={selectedOptions[attr] === option ? { backgroundColor: 'var(--store-primary)', borderColor: 'var(--store-primary)', color: 'white' } : {}}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                {currentStock > 0 ? (
                  <ThemedBadge colorRole="primary" variant="outline">In Stock</ThemedBadge>
                ) : (
                  <ThemedBadge colorRole="primary" variant="destructive">Out of Stock</ThemedBadge>
                )}
                <p className="text-sm text-muted-foreground mt-2">{currentStock} units available</p>
              </div>

              {/* ... MOQ Alert ... */}

              <div className="flex flex-col gap-2">
                {cartItem ? (
                  // ... Cart Item Controls ...
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
                      disabled={currentStock === 0}
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
      </div>
    </Sheet>
  );
}
