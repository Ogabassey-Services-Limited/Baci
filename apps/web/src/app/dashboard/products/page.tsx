import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { getMerchantForUser } from '@/lib/merchant-server';
import { getProducts } from '@/lib/products-server';
import { createClient } from '@/lib/supabase/server';
import ProductsClientPage from './client-page';

export const metadata = {
  title: 'Products | Baci',
  description: 'Manage your product catalog',
};

// Allow AI processing to run for up to 5 minutes
export const maxDuration = 300;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Get Merchant (Cached)
  const { merchant, user } = await getMerchantForUser();

  if (!user) {
    redirect('/login');
  }

  if (!merchant) {
    redirect('/onboarding');
  }

  // 2. Parse Params
  const params = await searchParams;
  const page =
    typeof params.page === 'string' ? Number.parseInt(params.page, 10) : 1;
  const limit =
    typeof params.limit === 'string' ? Number.parseInt(params.limit, 10) : 10;
  const status = typeof params.status === 'string' ? params.status : 'All';
  const stock = typeof params.stock === 'string' ? params.stock : 'All';
  const migration =
    typeof params.migration === 'string' ? params.migration : 'All';
  const search = typeof params.search === 'string' ? params.search : undefined;

  // 3. Fetch Products (Server-Side)
  // This runs directly on the server, bypassing the API route limit
  const initialData = await getProducts(supabase, merchant.id, {
    page,
    limit,
    migration,
    status,
    stock,
    search,
  });

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center min-h-[400px]">
          <BagLoader size={48} />
        </div>
      }
    >
      <ProductsClientPage initialData={initialData} />
    </Suspense>
  );
}
