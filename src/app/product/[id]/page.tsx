
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
import { ShoppingCart, ArrowLeft } from 'lucide-react';

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

  const footerLinks = [
    { key: 'about', label: 'About Us' },
    { key: 'contact', label: 'Contact' },
    { key: 'privacy', label: 'Privacy Policy' },
    { key: 'terms', label: 'Terms and Conditions' },
    { key: 'faq', label: 'FAQs' },
    { key: 'legal', label: 'Legal and Dispute' },
  ];

  const availableFooterLinks = footerLinks.filter(link => merchant?.pages?.[link.key as keyof typeof merchant.pages]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between shadow-sm sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="w-5 h-5" />
           Back to Store
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
            <Button variant="ghost" size="icon">
                <ShoppingCart className="w-6 h-6"/>
                <span className="sr-only">Cart</span>
            </Button>
        </nav>
      </header>

      <main className="flex-1 container mx-auto py-12 px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">
          <div className="bg-muted/50 rounded-lg overflow-hidden aspect-square">
            <Image
              src={product.imageLarge}
              alt={product.name}
              data-ai-hint={product.imageHint}
              width={600}
              height={600}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center space-y-6 py-4">
            <div>
              <h1 
                className="text-3xl lg:text-4xl font-bold font-headline"
                style={{ color: merchant?.colors?.primary || 'hsl(var(--primary))' }}
              >
                  {product.name}
              </h1>
              <p 
                className="text-3xl font-bold mt-2"
                style={{ color: merchant?.colors?.secondary || 'hsl(var(--accent))' }}
              >
                  {formatCurrency(product.price)}
              </p>
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
              <Button 
                size="lg" 
                className="w-full min-[400px]:w-auto" 
                disabled={product.stock === 0}
                style={{ backgroundColor: merchant?.colors?.primary || 'hsl(var(--primary))' }}
              >
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer 
        className="text-white"
        style={{ backgroundColor: merchant?.colors?.primary || 'hsl(var(--primary))' }}
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
