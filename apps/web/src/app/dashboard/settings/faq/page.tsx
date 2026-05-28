import { redirect } from 'next/navigation';
import { getCachedMerchant, getCachedProducts } from '@/lib/cached-data';
import { ensurePermission } from '@/lib/merchant-server';
import type { FAQItem } from '@/types/faq';
import { FAQSettingsClient } from './client';

export const metadata = {
  title: 'FAQ Settings | Dashboard',
  description: 'Manage your store FAQ content for better SEO',
};

export default async function FAQSettingsPage() {
  let merchantSlug: string | null = null;
  try {
    const { merchant } = await ensurePermission('settings', 'view');
    merchantSlug = merchant.slug ?? null;
  } catch {
    redirect('/dashboard');
  }

  if (!merchantSlug) {
    redirect('/onboarding');
  }

  const merchant = await getCachedMerchant(merchantSlug);
  if (!merchant) {
    redirect('/onboarding');
  }

  // Get sample products for FAQ generation context
  const products = await getCachedProducts(merchant.id, {
    includeVariants: false,
    limit: 10,
  });
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
