'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { SetupInstructions } from '@/components/analytics/setup-instructions';

export default function TwitterIntegrationPage() {
    const { merchant, updateMerchant } = useMerchant();

    if (!merchant) {
        return <div>Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={asRoute('/dashboard/integrations')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Twitter (X) Ads</h1>
                    <p className="text-muted-foreground">
                        Track conversions from your X campaigns
                    </p>
                </div>
            </div>

            <TrackingPixelSection
                platform="Twitter (X)"
                pixelId={(merchant as any).twitter_pixel_id || ''}
                pixelLabel="Pixel ID"
                onSave={async (pixelId, token) => {
                    await updateMerchant({
                        twitter_pixel_id: pixelId,
                    } as any);
                }}
                description="The X Pixel allows you to track conversions and optimize your ad campaigns."
            >
                <SetupInstructions platform="twitter" />
            </TrackingPixelSection>
        </div>
    );
}
