'use server';

import { MerchantProvider } from '@/hooks/use-merchant';
import { ImeiCheckClient } from './imei-check-client';

export default async function ImeiCheckPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    return (
        <MerchantProvider slug={slug}>
            <ImeiCheckClient slug={slug} />
        </MerchantProvider>
    );
}
