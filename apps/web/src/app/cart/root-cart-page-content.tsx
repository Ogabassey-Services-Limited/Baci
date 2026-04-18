import { ShoppingCart, Store } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export async function RootCartPageContent() {
  const cookieStore = await cookies();
  const recentMerchant = cookieStore.get('recent-merchant')?.value;

  if (recentMerchant) {
    redirect(`/${recentMerchant}/cart`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
      <div className="text-center max-w-md px-6">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <ShoppingCart className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Your Cart is Empty
        </h1>
        <p className="text-gray-600 mb-6">
          Browse our marketplace to discover amazing products from verified
          merchants.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/ogabassey">
              <Store className="w-4 h-4 mr-2" />
              Browse Ogabassey Store
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Explore Baci Marketplace</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
