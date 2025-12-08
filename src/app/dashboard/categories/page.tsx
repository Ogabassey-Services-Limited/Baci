import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCategories } from '@/lib/products-server';
import CategoriesClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Categories | Baci Dashboard',
  description: 'Manage your product categories',
};

export default async function CategoriesPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get merchant ID
  const { data: merchantData } = await supabase
    .from('merchants')
    .select('id')
    .eq('users_id', user.id)
    .single();

  if (!merchantData) {
    redirect('/onboarding');
  }

  const categories = await getCategories(supabase, merchantData.id);

  return <CategoriesClientPage initialCategories={categories} />;
}
