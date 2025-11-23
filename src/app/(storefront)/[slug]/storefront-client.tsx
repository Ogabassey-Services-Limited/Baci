
'use client';

import { ThemedButton, ThemedCard, ThemedBadge, ThemedLink } from '@/components/themed';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { getBusinessTypeById } from '@/config/business-types';
import { type Product } from '@/lib/products';
import { Render } from '@measured/puck';
import { builderConfig } from '@/components/builder/config';
import { Loader2, ShoppingCart, X, Plus, Minus, Trash2, Menu, Search, ShoppingBag } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { getCountryByCode } from '@/lib/countries';
import { Input } from '@/components/ui/input';
import { useState, useMemo, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { findDarkestColor, getContrastingTextColor } from '@/lib/color-utils';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api-client';
import AppBody from '@/components/app-body';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from '@/lib/utils';
import { StorefrontProvider } from '@/contexts/storefront-context';


// New component to handle the layout and theming
function ThemedStorefrontLayout({ children }: { children: React.ReactNode }) {
  const { merchant } = useMerchant();
  return <AppBody merchant={merchant}>{children}</AppBody>;
}


function StorefrontContent() {
  const { merchant } = useMerchant();
  const [searchQuery, setSearchQuery] = useState('');
  const { cart, cartCount, addToCart, updateQuantity } = useCart();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }));
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [customConfig, setCustomConfig] = useState<any>(null);

  useEffect(() => {
    if (!api) {
      return
    }

    setCurrent(api.selectedScrollSnap() + 1)
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api])


  useEffect(() => {
    if (merchant?.id) {
      // Load products
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

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    toast({
      title: "Added to cart!",
      description: `${product.name} has been added to your cart.`,
    });
  };

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

    // Search first
    if (searchQuery && fuse) {
      filtered = fuse.search(searchQuery).map(result => result.item);
    }

    // Then filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => (p.category || 'General') === selectedCategory);
    }

    return filtered.filter(p => p.status === 'published');
  }, [searchQuery, fuse, products, selectedCategory]);

  if (!merchant) return null; // Should be handled by parent

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

  const footerLinks = [
    { key: 'about', label: 'About Us' },
    { key: 'contact', label: 'Contact' },
    { key: 'privacy', label: 'Privacy Policy' },
    { key: 'terms', label: 'Terms and Conditions' },
    { key: 'faq', label: 'FAQs' },
    { key: 'legal', label: 'Legal and Dispute' },
  ];

  const availableFooterLinks = footerLinks.filter(link => merchant.pages?.[link.key as keyof typeof merchant.pages]);

  const brandColors = merchant.brand_colors ? [merchant.brand_colors.primary, merchant.brand_colors.background, merchant.brand_colors.accent].filter(Boolean) : ['#3F51B5'];
  const darkestColor = findDarkestColor(brandColors as string[]);

  const heroSlides = PlaceHolderImages.slice(0, 3).map((img, i) => ({
    ...img,
    headline: `Elevate Your Style, Slide ${i + 1}`,
    description: "Discover our latest collection of premium apparel.",
    cta: "Shop Now"
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <Sheet>
        <header className="px-4 lg:px-6 h-16 flex items-center gap-4 shadow-sm bg-card">
          <div className="flex items-center gap-2 font-semibold">
            {merchant.logo_url ? (
              <Image src={merchant.logo_url} alt={`${merchant.business_name} logo`} width={32} height={32} className="rounded-sm object-contain" />
            ) : (
              <Logo />
            )}
            <span className="hidden sm:inline-block">{merchant.business_name}</span>
          </div>

          <div className="flex-1 flex justify-center px-4">
            <div className="w-full max-w-md relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                className="w-full appearance-none bg-background pl-8 shadow-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard/orders">
              <ThemedButton colorRole="primary">My Dashboard</ThemedButton>
            </Link>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10">
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && <ThemedBadge colorRole="accent" variant="default" className="absolute -top-1 -right-1 h-5 w-5 text-xs justify-center rounded-full p-0">{cartCount}</ThemedBadge>}
                <span className="sr-only">Cart</span>
              </Button>
            </SheetTrigger>
          </nav>
        </header>

        <main className="flex-1">
          <section className="w-full relative">
            <Carousel
              setApi={setApi}
              className="w-full"
              plugins={[plugin.current]}
              onMouseEnter={plugin.current.stop}
              onMouseLeave={plugin.current.reset}
              opts={{ loop: true }}
            >
              <CarouselContent>
                {heroSlides.map((slide, index) => {
                  const heroImage = PlaceHolderImages.find(p => p.id === slide.id) || { imageUrl: slide.imageUrl, description: slide.headline, imageHint: 'store hero' };
                  return (
                    <CarouselItem key={index}>
                      <div className="w-full h-[60vh] md:h-[70vh] relative">
                        <Image
                          src={heroImage.imageUrl}
                          alt={heroImage.description}
                          fill
                          className="object-cover"
                          data-ai-hint={heroImage.imageHint}
                          priority={index === 0}
                        />
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center text-white p-4">
                          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                            {slide.headline}
                          </h1>
                          <p className="mt-4 max-w-2xl text-lg md:text-xl">
                            {slide.description}
                          </p>
                          <ThemedButton asChild size="lg" className="mt-6" colorRole="accent">
                            <Link href="#products">
                              {slide.cta}
                            </Link>
                          </ThemedButton>
                        </div>
                      </div>
                    </CarouselItem>
                  )
                })}
              </CarouselContent>
              <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex" />
              <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden md:flex" />
            </Carousel>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    current - 1 === index ? "w-4 bg-white" : "bg-white/50"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </section>

          <section className="w-full py-12 md:py-24 lg:py-32" id="products">
            <div className="container px-4 md:px-6">
              <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl text-center mb-10" style={{ color: darkestColor }}>Our Products</h2>

              {/* Category Filter */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                            priority={index === 0}
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
        </main>

        <footer
          className="text-white"
          style={{ backgroundColor: darkestColor, color: getContrastingTextColor(darkestColor) }}
        >
          <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">{merchant.business_name}</h3>
                <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
              </div>
              {availableFooterLinks.length > 0 && (
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                  <nav className="grid grid-cols-2 gap-2">
                    {availableFooterLinks.map((link) => (
                      <ThemedLink key={link.key} className="text-sm hover:underline underline-offset-4 opacity-80 hover:opacity-100" href={`/pages/${link.key}`}>
                        {link.label}
                      </ThemedLink>
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


export function Storefront() {
  const { merchant, loading } = useMerchant();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-center px-4">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl">Store Not Found</h1>
        <p className="max-w-[600px] text-muted-foreground md:text-xl mt-4">
          The store you're looking for doesn't exist or the URL is incorrect. Please double-check the address. If you're the store owner, make sure you have completed the onboarding process.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Return to Baci Home</Link>
        </Button>
      </div>
    );
  }

  const businessTypeConfig = getBusinessTypeById(merchant.business_type);
  const StoreTemplate = businessTypeConfig?.template;

  if (!StoreTemplate) {
    return <div>Error: Store template not found for business type '{merchant.business_type}'.</div>
  }

  return (
    <ThemedStorefrontLayout>
      <StoreTemplate>
        <StorefrontProvider>
          {merchant.published_config ? (
            <Render config={builderConfig} data={merchant.published_config} />
          ) : (
            <StorefrontContent />
          )}
        </StorefrontProvider>
      </StoreTemplate>
    </ThemedStorefrontLayout>
  );
}
