import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCategories } from '@/lib/products-server';
import { createClient } from '@/lib/supabase/server';
import { getMerchantForUser } from '@/lib/merchant-server';
import CategoriesClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Categories | Baci Dashboard',
  description: 'Manage your product categories',
};

export default async function CategoriesPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { merchant, user } = await getMerchantForUser();

  if (!user) {
    redirect('/login');
  }

  if (!merchant) {
    redirect('/onboarding');
  }

  const categories = await getCategories(supabase, merchant.id);

  return <CategoriesClientPage initialCategories={categories} />;
}
