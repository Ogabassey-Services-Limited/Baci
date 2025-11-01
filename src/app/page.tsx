

'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchant, MerchantProvider } from '@/hooks/use-merchant';
import { getBusinessTypeById } from '@/config/business-types';
import { products } from '@/lib/products';
import { Loader2, ShoppingCart, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getCountryByCode } from '@/lib/countries';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

function Storefront() {
  const { merchant, loading } = useMerchant();
  const [searchQuery, setSearchQuery] = useState('');
  const { cartCount, addToCart } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (product: typeof products[0]) => {
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
  }, [products]);

  const searchResults = useMemo(() => {
    if (!searchQuery || !fuse) {
      return products.filter(p => p.status === 'active');
    }
    return fuse.search(searchQuery).map(result => result.item).filter(p => p.status === 'active');
  }, [searchQuery, fuse, products]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold">No Store Found</h2>
        <p className="text-muted-foreground mt-2">
          It looks like you haven't created a store yet.
        </p>
        <Link href="/onboarding" className="mt-4">
          <Button>Create Your Store</Button>
        </Link>
      </div>
    );
  }

  const businessTypeConfig = getBusinessTypeById(merchant.businessType);
  const StoreTemplate = businessTypeConfig?.template;
  
  if (!StoreTemplate) {
      return <div>Error: Store template not found for business type '{merchant.businessType}'.</div>
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

  return (
     <div className="flex flex-col min-h-screen">
       <header className="px-4 lg:px-6 h-16 flex items-center gap-4 shadow-sm bg-card">
         <div className="flex items-center gap-2 font-semibold">
           {merchant.logo ? (
              <Image src={merchant.logo} alt={`${merchant.businessName} logo`} width={32} height={32} className="rounded-sm" />
           ) : (
              <Logo/>
           )}
           <span className="hidden sm:inline-block">{merchant.businessName}</span>
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

        <nav className="flex items-center gap-4 sm:gap-6">
            <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="w-6 h-6"/>
                {cartCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center rounded-full p-0">{cartCount}</Badge>}
                <span className="sr-only">Cart</span>
            </Button>
            <Link href="/dashboard">
                <Button>My Dashboard</Button>
            </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Render the appropriate template */}
        <StoreTemplate>
            <section className="w-full py-12 md:py-24 lg:py-32" style={{ 
                // @ts-ignore
                '--store-primary': merchant.colors?.primary, '--store-secondary': merchant.colors?.secondary }}>
                <div className="container px-4 md:px-6">
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl" style={{ color: 'var(--store-primary)' }}>
                            Welcome to {merchant.businessName}
                        </h1>
                        <p className="max-w-[700px] text-muted-foreground md:text-xl">
                            Your one-stop shop for the best {merchant.businessType} products.
                        </p>
                    </div>
                </div>
            </section>
            
            <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/20">
                <div className="container px-4 md:px-6">
                    <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl text-center mb-10">Our Products</h2>
                    {searchResults.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {searchResults.map((product, index) => (
                              <Card key={product.id} className="overflow-hidden">
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
                                  <CardContent className="p-4">
                                      <h3 className="font-semibold text-lg">{product.name}</h3>
                                      <p className="text-muted-foreground text-sm mt-1 truncate">{product.description}</p>
                                      <div className="flex items-center justify-between mt-4">
                                          <p className="text-lg font-bold" style={{ color: 'var(--store-primary)' }}>{formatCurrency(product.price)}</p>
                                          <Button size="sm" onClick={() => handleAddToCart(product)}>Add to Cart</Button>
                                      </div>
                                  </CardContent>
                              </Card>
                          ))}
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
        style={{ backgroundColor: merchant.colors?.primary || 'hsl(var(--primary))' }}
       >
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                     <h3 className="text-lg font-semibold mb-4">{merchant.businessName}</h3>
                     <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} {merchant.businessName}. All rights reserved.</p>
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
    </div>
  );
}

// The original landing page is now a fallback if no merchant data exists.
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
        <Logo />
        <nav className="ml-auto flex gap-4 sm:gap-6">
           <Button asChild variant="outline">
              <Link href="/onboarding">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/onboarding">Get Started</Link>
            </Button>
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
                   <Button asChild size="lg">
                    <Link href="/onboarding">Create Your Store for Free</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function PageContent() {
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
            <PageContent />
        </MerchantProvider>
    )
}
