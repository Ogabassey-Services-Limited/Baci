'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { SetupInstructions } from '@/components/analytics/setup-instructions';

export default function SnapchatIntegrationPage() {
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
                    <h1 className="text-2xl font-bold tracking-tight">Snapchat Ads</h1>
                    <p className="text-muted-foreground">
                        Track conversions from your Snapchat campaigns
                    </p>
                </div>
            </div>

            <TrackingPixelSection
                platform="Snapchat"
                pixelId={(merchant as any).snapchat_pixel_id || ''}
                accessToken={(merchant as any).snapchat_capi_token || ''}
                pixelLabel="Snap Pixel ID"
                tokenLabel="Conversion API Token (Optional)"
                onSave={async (pixelId, token) => {
                    await updateMerchant({
                        snapchat_pixel_id: pixelId,
                        snapchat_capi_token: token,
                    } as any);
                }}
                description="The Snap Pixel helps you measure the cross-device impact of your campaigns."
            >
                <SetupInstructions platform="snapchat" />
            </TrackingPixelSection>
        </div>
    );
}
