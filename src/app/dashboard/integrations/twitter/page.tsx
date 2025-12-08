'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { TrackingPixelSection } from '@/components/dashboard/integrations/tracking-pixel-section';
import { Button } from '@/components/ui/button';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';

export default function TwitterIntegrationPage() {
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [pixelId, setPixelId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (merchant) {
      fetch('/api/merchant/features')
        .then((res) => res.json())
        .then((data) => {
          if (data.twitter_pixel_id) {
            setPixelId(data.twitter_pixel_id);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [merchant]);

  const handleSave = async (newPixelId: string) => {
    try {
      const res = await fetch('/api/merchant/features', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          twitter_pixel_id: newPixelId,
        }),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setPixelId(newPixelId);
      toast({
        title: 'Settings saved',
        description: 'Your Twitter pixel settings have been updated.',
      });
    } catch (error) {
      console.error('Error saving Twitter settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
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
        pixelId={pixelId}
        pixelLabel="Pixel ID"
        onSave={handleSave}
        description="The X Pixel allows you to track conversions and optimize your ad campaigns."
      >
        <SetupInstructions platform="twitter" />
      </TrackingPixelSection>
    </div>
  );
}
