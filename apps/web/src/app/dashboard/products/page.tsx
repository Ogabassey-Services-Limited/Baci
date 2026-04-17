import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { getMerchantForUser } from '@/lib/merchant-server';
import { getProducts } from '@/lib/products-server';
import { createClient } from '@/lib/supabase/server';
import { productListQuerySchema } from '@/schemas/product-list-query';
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
  const parsedParams = productListQuerySchema.safeParse(params);
  if (!parsedParams.success) {
    console.warn(
      'Invalid product list query params',
      parsedParams.error.flatten()
    );
  }
  const { page, limit, status, stock, migration, search } = parsedParams.success
    ? parsedParams.data
    : productListQuerySchema.parse({});

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
