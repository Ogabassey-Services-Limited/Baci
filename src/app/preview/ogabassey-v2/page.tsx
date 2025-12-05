'use client';

import React from 'react';
import AppBody from '@/components/app-body';
import { GadgetCustomTemplateOgabasseyV2 } from '@/components/storefront/templates/gadget-custom-template-ogabassey-v2';
import { CartProvider } from '@/hooks/use-cart';
import { ComparisonProvider } from '@/hooks/use-comparison';
import { MerchantProvider, useMerchant } from '@/hooks/use-merchant';
import { SavedProvider } from '@/hooks/use-saved';
import { OgabasseyV2Navbar } from '@/components/storefront/ogabassey-v2/layout/navbar';
import { OgabasseyV2Footer } from '@/components/storefront/ogabassey-v2/layout/footer';
import { OgabasseyV2MobileFooter } from '@/components/storefront/ogabassey-v2/layout/mobile-footer';

function PreviewContent() {
  const { merchant, loading } = useMerchant();

  if (loading || !merchant) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <AppBody merchant={merchant}>
      <OgabasseyV2Navbar
        logo={merchant.logo_url}
        storeName={merchant.business_name}
      />
      <GadgetCustomTemplateOgabasseyV2 />
      <OgabasseyV2Footer
        logo={merchant.logo_url}
      />
      <OgabasseyV2MobileFooter />
    </AppBody>
  );
}

export default function OgabasseyV2PreviewPage() {
  return (
    <MerchantProvider slug="ogabassey-v2">
      <CartProvider>
        <SavedProvider>
          <ComparisonProvider>
            <PreviewContent />
          </ComparisonProvider>
        </SavedProvider>
      </CartProvider>
    </MerchantProvider>
  );
}
