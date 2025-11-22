
'use client';

import { MerchantProvider, useMerchant } from '@/hooks/use-merchant';
import { Storefront } from './storefront-client';
import AppBody from '@/components/app-body';

function ThemedStorefront() {
    const { merchant } = useMerchant();
    return (
        <AppBody merchant={merchant}>
            <Storefront />
        </AppBody>
    )
}

export default function StorefrontPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    if (typeof slug !== 'string' || !slug.trim()) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>Invalid store URL.</p>
            </div>
        );
    }

    return (
        <MerchantProvider slug={slug}>
            <ThemedStorefront />
        </MerchantProvider>
    );
}
