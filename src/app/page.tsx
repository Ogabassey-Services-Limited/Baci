
'use client';

import { Button } from '@/components/ui/button';
import { ThemedButton, ThemedCard } from '@/components/themed';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchant, MerchantProvider } from '@/hooks/use-merchant';
import { getBusinessTypeById } from '@/config/business-types';
import { products, type Product } from '@/lib/products';
import { Loader2, ShoppingBag, Search, Plus, Minus } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { getCountryByCode } from '@/lib/countries';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getContrastingTextColor, findDarkestColor } from '@/lib/color-utils';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Cart } from '@/components/cart';

function Storefront() {
  const { merchant, loading } = useMerchant();
  const [searchQuery, setSearchQuery] = useState('');
  const { cart, cartCount, addToCart, updateQuantity } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    toast({
        title: "Added to cart!",
        description: `${product.name} has been added to your cart.`,
    });
  };

  const fuse = useMemo(() => {
    if (products) {
      return new Fuse(products, {
        keys: ['name', 'description', 'brand'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    return null;
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery || !fuse) {
      return products.filter(p => p.status === 'active');
    }
    return fuse.search(searchQuery).map(result => result.item).filter(p => p.status === 'active');
  }, [searchQuery, fuse]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // This case should ideally not be hit if this component is only rendered when a merchant exists
  if (!merchant) {
    return null;
  }

  const businessTypeConfig = getBusinessTypeById(merchant.business_type);
  const StoreTemplate = businessTypeConfig?.template;
  
  if (!StoreTemplate) {
      return <div>Error: Store template not found for business type '{merchant.business_type}'.</div>
  }

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
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

  const brandColors = merchant.colors ? [merchant.colors.primary, merchant.colors.secondary, merchant.colors.accent] : ['#3F51B5'];
  const darkestColor = findDarkestColor(brandColors);


  return (
     <div
      className="flex flex-col min-h-screen"
      style={{
        // @ts-ignore - Define CSS variables at root for all children including Sheet
        '--store-primary': merchant.colors?.primary || '#3F51B5',
        '--store-secondary': merchant.colors?.secondary || '#9C27B0',
        '--store-accent': merchant.colors?.accent || '#FFC107',
        '--store-primary-text': getContrastingTextColor(merchant.colors?.primary || '#3F51B5'),
        '--store-secondary-text': getContrastingTextColor(merchant.colors?.secondary || '#9C27B0'),
        '--store-accent-text': getContrastingTextColor(merchant.colors?.accent || '#FFC107'),
      }}
     >
      <Sheet>
       <header className="px-4 lg:px-6 h-16 flex items-center gap-4 shadow-sm bg-card">
         <div className="flex items-center gap-2 font-semibold">
           {merchant.logo_url ? (
              <Image src={merchant.logo_url} alt={`${merchant.business_name} logo`} width={32} height={32} className="rounded-sm object-contain" />
           ) : (
              <Logo/>
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
            <Link href="/dashboard">
                <ThemedButton colorRole="primary">My Dashboard</ThemedButton>
            </Link>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-10 w-10">
                    <ShoppingBag className="w-5 h-5"/>
                    {cartCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 text-xs justify-center rounded-full p-0">{cartCount}</Badge>}
                    <span className="sr-only">Cart</span>
                </Button>
            </SheetTrigger>
        </nav>
      </header>

      <main className="flex-1">
        {/* Render the appropriate template */}
        <StoreTemplate>
            <section className="w-full py-12 md:py-24 lg:py-32">
                <div className="container px-4 md:px-6">
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl" style={{ color: 'var(--store-primary)' }}>
                            Welcome to {merchant.business_name}
                        </h1>
                        <p className="max-w-[700px] text-muted-foreground md:text-xl">
                            Your one-stop shop for the best {merchant.business_type} products.
                        </p>
                    </div>
                </div>
            </section>
            
            <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/20">
                <div className="container px-4 md:px-6">
                    <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl text-center mb-10" style={{ color: darkestColor }}>Our Products</h2>
                    {searchResults.length > 0 ? (
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

        </StoreTemplate>
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

function BaciLandingPage() {
   const features = [
    {
      icon: '🤖',
      title: 'Intelligent Onboarding',
      description: 'Define your business and brand preferences with a simple 3-question setup, featuring AI-powered color extraction and logo creation.',
    },
    {
      icon: '🎨',
      title: 'AI Content Generation',
      description: 'Effortlessly generate compelling product descriptions with AI, tailored to your specific business category.',
    },
    {
      icon: '📸',
      title: 'Photo Enhancement',
      description: 'Automatically enhance product photos with background removal, lighting adjustments, and optimal cropping.',
    },
    {
      icon: '⚡️',
      title: 'One-Click Store Creation',
      description: 'Generate a fully functional, mobile-responsive e-commerce website in seconds from your inputs.',
    },
  ];
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm">
        <Link href="/" className="flex items-center justify-center">
            <Logo />
            <span className="sr-only">Baci</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
           <Link href="/dashboard" legacyBehavior passHref>
              <Button asChild variant="outline">
                <a>Sign In</a>
              </Button>
            </Link>
            <Link href="/onboarding" legacyBehavior passHref>
              <Button asChild>
                <a>Get Started</a>
              </Button>
            </Link>
        </nav>
      </header>
       <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-card">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                    Build Your E-commerce Empire with AI
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Baci is an AI-powered platform that helps you launch a professional online store in minutes. No coding, no design skills needed.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                    <Link href="/onboarding" legacyBehavior passHref>
                      <Button asChild size="lg">
                        <a>Create Your Store for Free</a>
                      </Button>
                    </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

// This component now decides which page to show on the client-side
function ClientHomePage() {
  const { merchant, loading } = useMerchant();

  if (loading) {
     return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  
  // If merchant data exists, show their storefront. Otherwise, show the Baci landing page.
  return merchant ? <Storefront /> : <BaciLandingPage />;
}


export default function HomePage() {
    return (
        <MerchantProvider>
            <ClientHomePage />
        </MerchantProvider>
    )
}
