'use client';

import { PuckStorefront } from '@/components/storefront/puck-storefront';
import { Storefront } from './storefront-client';
import { useState } from 'react';

/**
 * Wrapper that tries to render Puck storefront first,
 * falls back to hardcoded template if no Puck config exists
 */
export function StorefrontWrapper() {
    const [showFallback, setShowFallback] = useState(false);

    return (
        <>
            {!showFallback && <PuckStorefront onNoConfig={() => setShowFallback(true)} />}
            {showFallback && <Storefront />}
        </>
    );
}
