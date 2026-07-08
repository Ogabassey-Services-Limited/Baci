'use client';

import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaypalMode } from './paypal-provider-status';

/**
 * The environment select + write-only client ID/secret form for the PayPal
 * BYOK connection card, plus its connected/reconnect status banners. Split
 * out of `paypal-provider-card.tsx` to keep that file under the repo's
 * 300-line budget — this component is purely presentational; all network
 * calls and state live in the parent.
 */
interface PaypalConnectionFormProps {
  mode: PaypalMode;
  modePending: boolean;
  onModeChange: (mode: PaypalMode) => void;
  isConnectedForMode: boolean;
  last4: string | null;
  reconnectError: string | null;
  clientId: string;
  onClientIdChange: (value: string) => void;
  secretKey: string;
  onSecretKeyChange: (value: string) => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
}

export function PaypalConnectionForm({
  mode,
  modePending,
  onModeChange,
  isConnectedForMode,
  last4,
  reconnectError,
  clientId,
  onClientIdChange,
  secretKey,
  onSecretKeyChange,
  saving,
  saveError,
  onSave,
}: PaypalConnectionFormProps) {
  return (
    <>
      {isConnectedForMode && last4 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/10 dark:border-green-800 dark:text-green-400">
          <Check className="size-5 shrink-0" />
          <div>
            <p className="font-medium flex items-center gap-2">
              Connected
              <Badge variant="secondary">
                {mode === 'live' ? 'Live' : 'Sandbox'}
              </Badge>
            </p>
            <p className="text-sm">Ending in {last4}</p>
          </div>
        </div>
      )}

      {reconnectError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 dark:bg-yellow-900/10 dark:border-yellow-800 dark:text-yellow-400">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="font-medium">PayPal disconnected</p>
            <p className="text-sm">{reconnectError} Reconnect below.</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="paypal_mode">Environment</Label>
        <Select
          value={mode}
          onValueChange={(value: PaypalMode) => onModeChange(value)}
        >
          <SelectTrigger id="paypal_mode" disabled={modePending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
            <SelectItem value="live">Live (Production)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="paypal_client_id">Client ID</Label>
          <Input
            id="paypal_client_id"
            placeholder="Enter PayPal Client ID"
            value={clientId}
            onChange={(event) => onClientIdChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paypal_secret_key">Secret Key</Label>
          <Input
            id="paypal_secret_key"
            type="password"
            placeholder={
              isConnectedForMode
                ? 'Enter a new secret to rotate it'
                : 'Enter PayPal Secret Key'
            }
            value={secretKey}
            onChange={(event) => onSecretKeyChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Baci never displays a saved secret again. Paste a new one to connect
            or rotate it.
          </p>
        </div>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <Button
          onClick={onSave}
          disabled={saving || !clientId.trim() || !secretKey.trim()}
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isConnectedForMode ? 'Update Credentials' : 'Connect PayPal'}
        </Button>
      </div>
    </>
  );
}
