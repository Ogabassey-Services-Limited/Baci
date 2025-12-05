import { notFound } from 'next/navigation';
import { getCachedMerchant } from '@/lib/cached-data';
import { NewTemplateCheckoutPage } from '@/components/storefront/new-template';
import { StorefrontHeader as Header } from '@/components/storefront/header';
import { StorefrontFooter as Footer } from '@/components/storefront/footer';

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
  if ((merchant as any).template_id === 'new-template') {
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
