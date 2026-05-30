'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { Button } from '@/components/ui/button';
import { useIntegrationSettings } from '@/hooks/use-integration-settings';
import { asRoute } from '@/lib/routes';

interface TwitterSettings {
  twitter_pixel_id: string | null;
}

const SETTINGS_KEYS: (keyof TwitterSettings)[] = ['twitter_pixel_id'];

export default function TwitterIntegrationPage() {
  const { settings, isLoading, hasMerchant, saveSettings } =
    useIntegrationSettings<TwitterSettings>({
      keys: SETTINGS_KEYS,
      platformName: 'Twitter',
    });

  const handleSave = async (newPixelId: string) => {
    await saveSettings({
      twitter_pixel_id: newPixelId || null,
    });
  };

  if (!hasMerchant || isLoading) {
    return <div>Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={asRoute('/dashboard/integrations')}>
            <ArrowLeft className="size-4" />
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
        pixelId={settings?.twitter_pixel_id || ''}
        pixelLabel="Pixel ID"
        onSave={handleSave}
        description="The X Pixel allows you to track conversions and optimize your ad campaigns."
      >
        <SetupInstructions platform="twitter" />
      </TrackingPixelSection>
    </div>
  );
}
