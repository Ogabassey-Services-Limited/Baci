import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCachedMerchant, getCachedProducts } from '@/lib/cached-data';
import { createClient } from '@/lib/supabase/server';
import type { FAQItem } from '@/types/faq';
import { FAQSettingsClient } from './client';

export const metadata = {
  title: 'FAQ Settings | Dashboard',
  description: 'Manage your store FAQ content for better SEO',
};

export default async function FAQSettingsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get merchant data
  const { data: merchantRow } = await supabase
    .from('merchants')
    .select('slug')
    .eq('user_id', user.id)
    .single();

  if (!merchantRow) {
    redirect('/onboarding');
  }

  const merchant = await getCachedMerchant(merchantRow.slug);
  if (!merchant) {
    redirect('/onboarding');
  }

  // Get sample products for FAQ generation context
  const products = await getCachedProducts(merchant.id, { limit: 10 });
  const sampleProducts = products.slice(0, 10).map(
    (
      // biome-ignore lint/suspicious/noExplicitAny: Product type mismatch with DB
      p: any
    ) => ({
      name: p.name,
      category: p.product_categories?.[0]?.categories?.name || undefined,
      price: p.base_price,
    })
  );

  return (
    <FAQSettingsClient
      merchant={merchant}
      sampleProducts={sampleProducts}
      initialFAQs={
        (merchant as unknown as { faq_items?: FAQItem[] }).faq_items || []
      }
    />
  );
}
