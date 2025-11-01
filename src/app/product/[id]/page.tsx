
'use client';

import { getProductById } from '@/lib/products';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMerchant, MerchantProvider } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ShoppingCart } from 'lucide-react';

function ProductDetail({ productId }: { productId: string }) {
  const product = getProductById(productId);
  const { merchant } = useMerchant();

  if (!product || product.status !== 'active') {
    notFound();
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

  const storeName = merchant?.businessName || 'Baci Store';

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm">
        <Link href="/" className="flex items-center gap-2 font-semibold">
           <Logo/>
           <span className="hidden sm:inline-block">{storeName}</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
            <Button variant="ghost" size="icon">
                <ShoppingCart className="w-6 h-6"/>
                <span className="sr-only">Cart</span>
            </Button>
            <Link href="/dashboard">
                <Button>My Dashboard</Button>
            </Link>
        </nav>
      </header>

      <main className="flex-1 container mx-auto py-12 px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="flex items-center justify-center bg-card rounded-lg overflow-hidden">
            <Image
              src={product.imageLarge}
              alt={product.name}
              data-ai-hint={product.imageHint}
              width={600}
              height={400}
              className="object-cover w-full h-auto aspect-video"
            />
          </div>
          <div className="flex flex-col justify-center space-y-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold font-headline">{product.name}</h1>
              <p className="text-2xl font-semibold text-primary mt-2">{formatCurrency(product.price)}</p>
            </div>
            
            <p className="text-muted-foreground text-lg leading-relaxed">
              {product.description}
            </p>
            
            <div>
              {product.stock > 0 ? (
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
               <p className="text-sm text-muted-foreground mt-2">{product.stock} units available</p>
            </div>

            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button size="lg" className="w-full min-[400px]:w-auto" disabled={product.stock === 0}>
                Add to Cart
              </Button>
               <Button size="lg" variant="outline" className="w-full min-[400px]:w-auto">
                Buy Now
              </Button>
            </div>
          </div>
        </div>
      </main>

       <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <MerchantProvider>
      <ProductDetail productId={params.id} />
    </MerchantProvider>
  )
}
