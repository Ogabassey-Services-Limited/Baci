'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import dynamic from 'next/dynamic';

const DynamicPuckStorefront = dynamic(
  () => import('@/components/storefront/puck-storefront').then((mod) => mod.PuckStorefront),
  { ssr: false } // Client-side only rendering
);

/**
 * Wrapper that renders Puck storefront.
 * Shows error if no Puck config exists (merchant needs to complete onboarding or visit builder).
 */
export function StorefrontWrapper() {
    const [showError, setShowError] = useState(false);

    if (showError) {
        return (
            <div
                className="flex flex-col min-h-screen items-center justify-center bg-background text-center px-4"
                style={{
                    paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                    paddingRight: 'max(1rem, env(safe-area-inset-right))',
                }}
            >
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl mb-4">Store Not Set Up</h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl mb-8">
                    Your store hasn't been set up yet. Please complete the onboarding process or visit the builder to create your store template.
                </p>
                <div className="flex gap-4">
                    <Button asChild>
                        <Link href="/onboarding">Complete Onboarding</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/builder">Open Builder</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <AnalyticsProvider />
            <DynamicPuckStorefront onNoConfig={() => setShowError(true)} />
        </>
    );
}
