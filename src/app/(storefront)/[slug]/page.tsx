'use server';

import { MerchantProvider } from '@/hooks/use-merchant';
import { StorefrontWrapper } from './storefront-wrapper';

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    if (typeof slug !== 'string' || !slug.trim()) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>Invalid store URL.</p>
            </div>
        );
    }

    return (
        <MerchantProvider slug={slug}>
            <StorefrontWrapper />
        </MerchantProvider>
    );
}
