'use client';

import React from 'react';
import { MerchantProvider } from '@/hooks/use-merchant';
import { CartProvider } from '@/hooks/use-cart';
import { SavedProvider } from '@/hooks/use-saved';
import { ComparisonProvider } from '@/hooks/use-comparison';
import { GadgetCustomTemplateOgabasseyV2 } from '@/components/storefront/templates/gadget-custom-template-ogabassey-v2';
import AppBody from '@/components/app-body';

export default function OgabasseyV2PreviewPage() {
  return (
    <MerchantProvider slug="ogabassey-v2">
      <CartProvider>
        <SavedProvider>
          <ComparisonProvider>
            <AppBody>
              <GadgetCustomTemplateOgabasseyV2 />
            </AppBody>
          </ComparisonProvider>
        </SavedProvider>
      </CartProvider>
    </MerchantProvider>
  );
}
