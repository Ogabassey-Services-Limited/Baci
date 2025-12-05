'use client';

import { AppBody } from '@/components/storefront/app-body';
import { ComparisonProvider } from '@/components/storefront/ogabassey-v2/contexts/ComparisonContext';
import { SavedProvider } from '@/components/storefront/ogabassey-v2/contexts/SavedContext';
import { OgabasseyV2Footer } from '@/components/storefront/ogabassey-v2/layout/footer';
import { OgabasseyV2MobileFooter } from '@/components/storefront/ogabassey-v2/layout/mobile-footer';
import { OgabasseyV2Navbar } from '@/components/storefront/ogabassey-v2/layout/navbar';
import { OgabasseyV2ProductDetails } from '@/components/storefront/ogabassey-v2/pages/product-details';
import { useMerchant } from '@/hooks/use-merchant';

interface ProductClientProps {
  slug: string;
  productId: string;
}

export function ProductClient({ slug, productId }: ProductClientProps) {
  const { merchant, loading } = useMerchant();

  if (loading || !merchant) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <SavedProvider>
      <ComparisonProvider>
        <AppBody merchant={merchant}>
          <OgabasseyV2Navbar
            logo={merchant.logo_url}
            storeName={merchant.business_name}
          />
          <OgabasseyV2ProductDetails storeSlug={slug} productId={productId} />
          <OgabasseyV2MobileFooter />
          <OgabasseyV2Footer />
        </AppBody>
      </ComparisonProvider>
    </SavedProvider>
  );
}
