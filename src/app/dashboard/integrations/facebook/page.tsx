'use client';

import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { useMerchant } from '@/hooks/use-merchant';

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
