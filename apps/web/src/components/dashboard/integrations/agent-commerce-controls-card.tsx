'use client';

import { AlertCircle, Loader2, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiGet, apiPatch } from '@/lib/api-client';

const FEATURES_ENDPOINT = '/api/merchant/features';

type AgentCommerceFeatureSettings = {
  agentic_checkout_enabled?: boolean;
};

function getStatusLabel(enabled: boolean) {
  return enabled ? 'Accepting agent checkouts' : 'Agent checkout paused';
}

export function AgentCommerceControlsCard() {
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const settings =
          await apiGet<AgentCommerceFeatureSettings>(FEATURES_ENDPOINT);
        if (isMounted) {
          setEnabled(settings.agentic_checkout_enabled !== false);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load agent checkout controls'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async (nextEnabled: boolean) => {
    const previousEnabled = enabled;
    setEnabled(nextEnabled);
    setIsSaving(true);
    setError(null);

    try {
      const updated = await apiPatch<AgentCommerceFeatureSettings>(
        FEATURES_ENDPOINT,
        { agentic_checkout_enabled: nextEnabled }
      );
      setEnabled(updated.agentic_checkout_enabled !== false);
    } catch (saveError) {
      setEnabled(previousEnabled);
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save agent checkout controls'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="h-4 w-4" />
          Agent checkout controls
        </CardTitle>
        <CardDescription>
          Control whether signed shopping agents can create, update, complete,
          and cancel agentic checkout sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agent checkout controls...
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="agent-checkout-toggle" className="font-medium">
                Agent checkout
              </Label>
              <p className="text-sm text-muted-foreground">
                {getStatusLabel(enabled)}
              </p>
            </div>
            <Switch
              id="agent-checkout-toggle"
              checked={enabled}
              disabled={isSaving}
              onCheckedChange={handleToggle}
            />
          </div>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
