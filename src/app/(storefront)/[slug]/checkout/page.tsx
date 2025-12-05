import { notFound } from 'next/navigation';
import { StorefrontFooter as Footer } from '@/components/storefront/footer';
import { StorefrontHeader as Header } from '@/components/storefront/header';
import { NewTemplateCheckoutPage } from '@/components/storefront/new-template';
import { getCachedMerchant } from '@/lib/cached-data';

export default async function CheckoutPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const merchant = await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check for new template
  if (
    (merchant as unknown as { template_id?: string }).template_id ===
    'new-template'
  ) {
    return <NewTemplateCheckoutPage />;
  }

  // Fallback
  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Checkout</h1>
        <p>Checkout functionality for this template is coming soon.</p>
      </div>
      <Footer />
    </>
  );
}
