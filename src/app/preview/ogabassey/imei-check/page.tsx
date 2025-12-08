'use client';

import { OgabasseyFooter } from '@/components/storefront/ogabassey/layout/footer';
import { MobileFooter as OgabasseyMobileFooter } from '@/components/storefront/ogabassey/layout/mobile-footer';
import { OgabasseyNavbar } from '@/components/storefront/ogabassey/layout/navbar';
import { OgabasseyImeiChecker } from '@/components/storefront/ogabassey/pages/imei-checker';
import { CartProvider } from '@/hooks/use-cart';
import { V2SavedProvider } from '@/components/storefront/ogabassey/providers/v2-saved-context';

export default function ImeiCheckPage() {
    return (
        <CartProvider enableSmartCartPro={true}>
            <V2SavedProvider>
                <div className="min-h-screen bg-white">
                    <OgabasseyNavbar
                        storeName="Ogabassey"
                        storeSlug="ogabassey"
                        showSearch={true}
                        showCart={true}
                        showUser={true}
                        showBell={true}
                    />

                    <OgabasseyImeiChecker />

                    <OgabasseyFooter storeSlug="ogabassey" />
                    <OgabasseyMobileFooter />
                </div>
            </V2SavedProvider>
        </CartProvider>
    );
}
