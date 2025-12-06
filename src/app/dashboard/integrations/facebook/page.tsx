'use client';

import { AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { FeedUrlSection } from '@/components/dashboard/integrations/feed-url-section';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

export default function FacebookIntegrationPage() {
  const { merchant, updateMerchant } = useMerchant();

  if (!merchant) {
    return <div>Loading...</div>;
  }
  // ... (rest of function until onSave)
  return (
    <div className="space-y-6">
      {/* ... prev content ... */}

      <TrackingPixelSection
        platform="Facebook"
        pixelId={(merchant as any).facebook_pixel_id || ''}
        accessToken={(merchant as any).facebook_capi_token || ''}
        pixelLabel="Pixel ID"
        tokenLabel="Conversion API Access Token"
        onSave={async (pixelId, token) => {
          await updateMerchant({
            facebook_pixel_id: pixelId,
            facebook_capi_token: token,
          } as any);
        }}
      >
        <SetupInstructions platform="facebook" />
      </TrackingPixelSection>
    </div>
  );
}

