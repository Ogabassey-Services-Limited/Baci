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
  google_analytics_id: string | null;
  ga4_api_secret: string | null;
}

export default function GoogleAnalyticsPage() {
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
            google_analytics_id: data.google_analytics_id,
            ga4_api_secret: data.ga4_api_secret,
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
    async (measurementId: string, apiSecret: string) => {
      try {
        const response = await fetch('/api/merchant/features', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_analytics_id: measurementId || null,
            ga4_api_secret: apiSecret || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save settings');
        }

        const data = await response.json();
        setSettings({
          google_analytics_id: data.google_analytics_id,
          ga4_api_secret: data.ga4_api_secret,
        });

        toast({
          title: 'Settings saved',
          description: 'Your Google Analytics settings have been updated.',
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
        pixelId={settings?.google_analytics_id || ''}
        accessToken={settings?.ga4_api_secret || ''}
        pixelLabel="Measurement ID (G-XXXXXXXXXX)"
        tokenLabel="API Secret (Optional)"
        onSave={handleSave}
        description="Connect your store to GA4 to track visitors, events, and ecommerce data."
      >
        <SetupInstructions platform="google" />
      </TrackingPixelSection>
    </div>
  );
}
