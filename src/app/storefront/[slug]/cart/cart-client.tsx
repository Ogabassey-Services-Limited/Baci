'use client';

import type React from 'react';
import { AppBody } from '@/components/storefront/ogabassey-v2/layout/app-body';
import { OgabasseyV2Footer } from '@/components/storefront/ogabassey-v2/layout/footer';
import { MobileFooter } from '@/components/storefront/ogabassey-v2/layout/mobile-footer';
import { OgabasseyV2Navbar } from '@/components/storefront/ogabassey-v2/layout/navbar';
import { OgabasseyV2CartPage } from '@/components/storefront/ogabassey-v2/pages/cart';
import { ComparisonProvider } from '@/hooks/use-comparison';
import { useMerchant } from '@/hooks/use-merchant';
import { SavedProvider } from '@/hooks/use-saved';

interface CartClientProps {
  slug: string;
}

export const CartClient: React.FC<CartClientProps> = ({ slug }) => {
  const { merchant } = useMerchant();

  return (
    <SavedProvider>
      <ComparisonProvider>
        <AppBody>
          <OgabasseyV2Navbar
            logo={merchant?.logo_url}
            storeName={merchant?.business_name}
            storeSlug={slug}
          />
          <OgabasseyV2CartPage storeSlug={slug} />
          <OgabasseyV2Footer storeSlug={slug} logo={merchant?.logo_url} />
          <MobileFooter />
        </AppBody>
      </ComparisonProvider>
    </SavedProvider>
  );
};
