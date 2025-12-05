'use client';

import AppBody from '@/components/app-body';
import { GadgetCustomTemplateOgabasseyV2 } from '@/components/storefront/templates/gadget-custom-template-ogabassey-v2';
import { CartProvider } from '@/hooks/use-cart';
import { ComparisonProvider } from '@/hooks/use-comparison';
import { MerchantProvider } from '@/hooks/use-merchant';
import { SavedProvider } from '@/hooks/use-saved';

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
