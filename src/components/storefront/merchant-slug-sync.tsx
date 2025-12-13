'use client';

import { useEffect } from 'react';
import { useCart } from '@/hooks/use-cart';

export function MerchantSlugSync({ slug }: { slug: string }) {
    const { setMerchantSlug, merchantSlug } = useCart();

    useEffect(() => {
        if (slug && merchantSlug !== slug) {
            setMerchantSlug(slug);
        }
    }, [slug, merchantSlug, setMerchantSlug]);

    return null;
}
