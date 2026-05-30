'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface TrackingPixelSectionProps {
  platform: string;
  pixelId: string;
  accessToken?: string;
  pixelLabel: string;
  tokenLabel?: string;
  onSave: (pixelId: string, token: string) => Promise<void>;
  description?: string;
  children?: React.ReactNode;
}

export function TrackingPixelSection({
  platform,
  pixelId,
  accessToken,
  pixelLabel,
  tokenLabel,
  onSave,
  description,
  children,
}: TrackingPixelSectionProps) {
  const [localPixelId, setLocalPixelId] = useState(pixelId);
  const [localToken, setLocalToken] = useState(accessToken || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localPixelId, localToken);
      toast({
        title: 'Settings Saved',
        description: `${platform} tracking settings have been updated.`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{platform} Tracking</CardTitle>
        <CardDescription>
          {description ||
            'Configure Pixel and Conversion API for better ad tracking.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="pixel-id" className="text-sm font-medium">
            {pixelLabel}
          </label>
          <Input
            id="pixel-id"
            value={localPixelId}
            onChange={(e) => setLocalPixelId(e.target.value)}
            placeholder={`Enter your ${platform} Pixel ID`}
          />
        </div>
        {tokenLabel && (
          <div className="space-y-2">
            <label htmlFor="access-token" className="text-sm font-medium">
              {tokenLabel}
            </label>
            <Input
              id="access-token"
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
              type="password"
              placeholder="Enter Access Token"
            />
            <p className="text-xs text-muted-foreground">
              Required for server-side tracking (maximum accuracy).
            </p>
          </div>
        )}
        {children}
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
