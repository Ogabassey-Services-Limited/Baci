import { notFound } from 'next/navigation';
import { StorefrontFooter as Footer } from '@/components/storefront/footer';
import { StorefrontHeader as Header } from '@/components/storefront/header';
import { NewTemplateCartPage } from '@/components/storefront/new-template';
import { getCachedMerchant } from '@/lib/cached-data';

export default async function CartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check for new template
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'new-template'
  ) {
    return <NewTemplateCartPage />;
  }

  // Fallback to default cart or error if not implemented for other templates
  // For now, we can render a simple placeholder or redirect
  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>
        <p>Cart functionality for this template is coming soon.</p>
      </div>
      <Footer />
    </>
  );
}
