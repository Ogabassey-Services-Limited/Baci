'use server';

import { MerchantProvider } from '@/hooks/use-merchant';
import { WalletClient } from './wallet-client';

export default async function WalletPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    return (
        <MerchantProvider slug={slug}>
            <WalletClient slug={slug} />
        </MerchantProvider>
    );
}
