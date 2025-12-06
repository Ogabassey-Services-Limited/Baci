'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { Button } from '@/components/ui/button';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

export default function GoogleAnalyticsPage() {
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
          <h1 className="text-2xl font-bold tracking-tight">
            Google Analytics 4
          </h1>
          <p className="text-muted-foreground">
            Measure traffic and engagement across your store
          </p>
        </div>
      </div>

      <TrackingPixelSection
        platform="Google Analytics 4"
        pixelId={(merchant as any).google_analytics_id || ''}
        accessToken={(merchant as any).ga4_api_secret || ''}
        pixelLabel="Measurement ID (G-XXXXXXXXXX)"
        tokenLabel="API Secret (Optional)"
        onSave={async (pixelId, token) => {
          await updateMerchant({
            google_analytics_id: pixelId,
            ga4_api_secret: token,
          } as any);
        }}
        description="Connect your store to GA4 to track visitors, events, and ecommerce data."
      >
        <SetupInstructions platform="google" />
      </TrackingPixelSection>
    </div>
  );
}
