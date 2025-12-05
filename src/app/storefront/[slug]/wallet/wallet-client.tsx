'use client';

import { Loader2 } from 'lucide-react';
import AppBody from '@/components/app-body';
import { OgabasseyV2Footer } from '@/components/storefront/ogabassey-v2/layout/footer';
import { OgabasseyV2MobileFooter } from '@/components/storefront/ogabassey-v2/layout/mobile-footer';
import { OgabasseyV2Navbar } from '@/components/storefront/ogabassey-v2/layout/navbar';
import { OgabasseyV2Wallet } from '@/components/storefront/ogabassey-v2/pages/wallet';
import { useMerchant } from '@/hooks/use-merchant';

export function WalletClient({ slug }: { slug: string }) {
  const { merchant, loading } = useMerchant();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!merchant) {
    return <div>Store not found</div>;
  }

  return (
    <AppBody merchant={merchant}>
      <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-red-100 selection:text-red-900">
        <OgabasseyV2Navbar
          storeSlug={slug}
          showSearch={true}
          showCart={true}
          showUser={true}
          showBell={true}
        />
        <main>
          <OgabasseyV2Wallet />
        </main>
        <OgabasseyV2Footer storeSlug={slug} />
        <OgabasseyV2MobileFooter />
      </div>
    </AppBody>
  );
}
