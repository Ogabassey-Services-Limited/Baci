'use client';

import { AlertCircle, Power } from 'lucide-react';
import { useState } from 'react';
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
import { apiPatch } from '@/lib/api-client';
import type { MerchantFeatureSettingsInput } from '@/schemas/merchant-features';

const FEATURES_ENDPOINT = '/api/merchant/features';

type AgentCommerceControlsCardProps = {
  initialEnabled: boolean;
};

function getStatusLabel(enabled: boolean) {
  return enabled ? 'Accepting agent checkouts' : 'Agent checkout paused';
}

export function AgentCommerceControlsCard({
  initialEnabled,
}: AgentCommerceControlsCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (nextEnabled: boolean) => {
    const previousEnabled = enabled;
    setEnabled(nextEnabled);
    setIsSaving(true);
    setError(null);

    try {
      const updated = await apiPatch<
        Partial<Pick<MerchantFeatureSettingsInput, 'agentic_checkout_enabled'>>
      >(FEATURES_ENDPOINT, { agentic_checkout_enabled: nextEnabled });
      setEnabled(updated.agentic_checkout_enabled ?? true);
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
