'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { Button } from '@/components/ui/button';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';

interface FeatureSettings {
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
}

export default function FacebookIntegrationPage() {
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<FeatureSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current settings from the correct table
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/merchant/features');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            facebook_pixel_id: data.facebook_pixel_id,
            facebook_capi_token: data.facebook_capi_token,
          });
        }
      } catch (error) {
        console.error('Failed to fetch feature settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (merchant) {
      fetchSettings();
    }
  }, [merchant]);

  // Save to the correct table via features API
  const handleSave = useCallback(
    async (pixelId: string, token: string) => {
      try {
        const response = await fetch('/api/merchant/features', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facebook_pixel_id: pixelId || null,
            facebook_capi_token: token || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

        const data = await response.json();
        setSettings({
          facebook_pixel_id: data.facebook_pixel_id,
          facebook_capi_token: data.facebook_capi_token,
        });

        toast({
          title: 'Settings saved',
          description: 'Your Facebook tracking settings have been updated.',
        });
      } catch (error) {
        console.error('Failed to save settings:', error);
        toast({
          variant: 'destructive',
          title: 'Save failed',
          description: 'Could not save your settings. Please try again.',
        });
        throw error;
      }
    },
    [toast]
  );

  if (!merchant || isLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight">Facebook Pixel</h1>
          <p className="text-muted-foreground">
            Track conversions and optimize your Facebook ad campaigns
          </p>
        </div>
      </div>

      <TrackingPixelSection
        platform="Facebook"
        pixelId={settings?.facebook_pixel_id || ''}
        accessToken={settings?.facebook_capi_token || ''}
        pixelLabel="Pixel ID"
        tokenLabel="Conversion API Access Token"
        onSave={handleSave}
      >
        <SetupInstructions platform="facebook" />
      </TrackingPixelSection>
    </div>
  );
}
