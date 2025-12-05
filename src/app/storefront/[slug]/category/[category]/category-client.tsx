'use client';

import { useMerchant } from '@/hooks/use-merchant';
import { AppBody } from '@/components/storefront/app-body';
import { OgabasseyV2Navbar } from '@/components/storefront/ogabassey-v2/layout/navbar';
import { OgabasseyV2Footer } from '@/components/storefront/ogabassey-v2/layout/footer';
import { OgabasseyV2MobileFooter } from '@/components/storefront/ogabassey-v2/layout/mobile-footer';
import { OgabasseyV2CategoryPage } from '@/components/storefront/ogabassey-v2/pages/category';
import { SavedProvider } from '@/components/storefront/ogabassey-v2/contexts/SavedContext';
import { ComparisonProvider } from '@/components/storefront/ogabassey-v2/contexts/ComparisonContext';

interface CategoryClientProps {
  slug: string;
  categoryName: string;
}

export function CategoryClient({ slug, categoryName }: CategoryClientProps) {
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
          <OgabasseyV2CategoryPage
            storeSlug={slug}
            categoryName={categoryName}
          />
          <OgabasseyV2MobileFooter />
          <OgabasseyV2Footer />
        </AppBody>
      </ComparisonProvider>
    </SavedProvider>
  );
}
