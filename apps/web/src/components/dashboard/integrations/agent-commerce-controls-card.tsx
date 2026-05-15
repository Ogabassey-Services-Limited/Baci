'use client';

import { AlertCircle, Power, Save } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { readAgenticRequestControls } from '@/lib/agentic/agent-request-controls';
import {
  AGENTIC_AGENT_ALLOWLIST_KEY,
  AGENTIC_AGENT_DENYLIST_KEY,
} from '@/lib/agentic/agent-request-controls.constants';
import { apiPatch } from '@/lib/api-client';
import type { MerchantFeatureSettingsInput } from '@/schemas/merchant-features';

const FEATURES_ENDPOINT = '/api/merchant/features';

type AgentCommerceControlsCardProps = {
  initialCustomSettings?: Record<string, unknown>;
  initialEnabled: boolean;
};

function getStatusLabel(enabled: boolean) {
  return enabled ? 'Accepting agent checkouts' : 'Agent checkout paused';
}

function formatPatterns(patterns: string[]) {
  return patterns.join('\n');
}

function parsePatternsInput(value: string) {
  const uniquePatterns = new Set<string>();

  for (const pattern of value.split(/[\n,]/)) {
    const normalized = pattern.trim().toLowerCase();
    if (normalized.length > 0) uniquePatterns.add(normalized);
  }

  return [...uniquePatterns];
}

function getRecordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function AgentCommerceControlsCard({
  initialCustomSettings = {},
  initialEnabled,
}: AgentCommerceControlsCardProps) {
  const initialControls = readAgenticRequestControls(initialCustomSettings);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [customSettings, setCustomSettings] = useState(initialCustomSettings);
  const [allowlistInput, setAllowlistInput] = useState(
    formatPatterns(initialControls.allowlist)
  );
  const [denylistInput, setDenylistInput] = useState(
    formatPatterns(initialControls.denylist)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggle = async (nextEnabled: boolean) => {
    const previousEnabled = enabled;
    setEnabled(nextEnabled);
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

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

  const handleSaveAgentAccessControls = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const nextCustomSettings = {
      ...customSettings,
      [AGENTIC_AGENT_ALLOWLIST_KEY]: parsePatternsInput(allowlistInput),
      [AGENTIC_AGENT_DENYLIST_KEY]: parsePatternsInput(denylistInput),
    };

    try {
      const updated = await apiPatch<
        Partial<Pick<MerchantFeatureSettingsInput, 'custom_settings'>>
      >(FEATURES_ENDPOINT, { custom_settings: nextCustomSettings });
      const updatedCustomSettings =
        getRecordValue(updated.custom_settings) ?? nextCustomSettings;
      const updatedControls = readAgenticRequestControls(updatedCustomSettings);
      setCustomSettings(updatedCustomSettings);
      setAllowlistInput(formatPatterns(updatedControls.allowlist));
      setDenylistInput(formatPatterns(updatedControls.denylist));
      setSuccessMessage('Agent access controls saved');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save agent access controls'
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

        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agent-allowlist">Trusted agent user-agents</Label>
            <Textarea
              id="agent-allowlist"
              placeholder="openai-agent"
              value={allowlistInput}
              onChange={(event) => setAllowlistInput(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-denylist">Blocked agent user-agents</Label>
            <Textarea
              id="agent-denylist"
              placeholder="badbot"
              value={denylistInput}
              onChange={(event) => setDenylistInput(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="button"
              onClick={handleSaveAgentAccessControls}
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              Save agent access controls
            </Button>
          </div>
        </div>

        {successMessage ? (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

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
