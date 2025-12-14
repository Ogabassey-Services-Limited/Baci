import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSEOStatus } from './actions';
import SEOClient from './seo-client';

export const metadata = {
  title: 'SEO Optimizer | Dashboard',
  description: 'AI-powered SEO optimization for your products',
};

export default async function SEOOptimizerPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    redirect('/onboarding');
  }

  // Fetch initial data with error handling
  let products: Awaited<ReturnType<typeof getSEOStatus>>['products'] = [];
  let summary: Awaited<ReturnType<typeof getSEOStatus>>['summary'] = null;

  try {
    const result = await getSEOStatus(merchant.id);
    products = result.products;
    summary = result.summary;
  } catch (error) {
    console.error('Failed to fetch SEO status:', error);
    // Products and summary remain at default values
  }

  return (
    <SEOClient
      initialProducts={products}
      initialSummary={summary}
      merchantId={merchant.id}
    />
  );
}
