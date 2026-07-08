'use client';

import { Globe, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PaypalConnectionForm } from './paypal-connection-form';
import {
  deletePaypalCredentials,
  loadPaypalCardData,
  persistPaypalFeatureConfig,
  savePaypalCredentials,
} from './paypal-provider-requests';
import {
  findRole,
  type PaymentCredentialStatusResponse,
  type PaypalMode,
  toVaultEnvironment,
} from './paypal-provider-status';

/**
 * Self-contained PayPal BYOK connection card for the payments settings page
 * (see docs/payments/byok-payment-providers-plan.md Phase 2, item 2). Secrets
 * are write-only: the client posts a client ID + secret once, and every
 * subsequent read is a status projection (configured / last4 / validation
 * state) from `/api/merchant/payment-credentials` — the ciphertext never
 * comes back to the browser. The enable toggle and environment mode are
 * non-secret config and continue to live in
 * `merchant_feature_settings.custom_settings`, saved through the existing
 * `/api/merchant/features` PATCH (see paypal-provider-requests.ts).
 */
export function PaypalProviderCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PaymentCredentialStatusResponse | null>(
    null
  );
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<PaypalMode>('sandbox');
  const [customSettings, setCustomSettings] = useState<Record<string, unknown>>(
    {}
  );
  const [togglePending, setTogglePending] = useState(false);
  const [modePending, setModePending] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPaypalCardData({
      setStatus,
      setEnabled,
      setMode,
      setCustomSettings,
      setLoading,
      toast,
    });
  }, [toast]);

  const vaultEnvironment = toVaultEnvironment(mode);
  const secretRole = findRole(status, 'secret_key', vaultEnvironment);
  const clientRole = findRole(status, 'client_id', vaultEnvironment);
  const isConnectedForMode = Boolean(
    secretRole?.isActive && clientRole?.isActive
  );
  const canEnable = isConnectedForMode && !secretRole?.lastValidationError;
  const reconnectError = isConnectedForMode
    ? null
    : (secretRole?.lastValidationError ?? null);

  async function handleToggleEnabled(checked: boolean) {
    const previous = enabled;
    setEnabled(checked);
    setTogglePending(true);
    try {
      const updated = await persistPaypalFeatureConfig(
        { paypal_enabled: checked },
        customSettings
      );
      setCustomSettings(updated);
    } catch {
      setEnabled(previous);
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description: 'Could not update PayPal enablement. Please try again.',
      });
    } finally {
      setTogglePending(false);
    }
  }

  async function handleModeChange(nextMode: PaypalMode) {
    const previous = mode;
    setMode(nextMode);
    setModePending(true);
    try {
      const updated = await persistPaypalFeatureConfig(
        { paypal_mode: nextMode },
        customSettings
      );
      setCustomSettings(updated);
    } catch {
      setMode(previous);
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description:
          'Could not update the PayPal environment. Please try again.',
      });
    } finally {
      setModePending(false);
    }
  }

  async function handleSaveCredentials() {
    setSaveError(null);
    setSaving(true);
    try {
      const data = await savePaypalCredentials({
        environment: vaultEnvironment,
        clientId,
        secretKey,
      });
      setStatus(data);
      setClientId('');
      setSecretKey('');
      const savedRole = findRole(data, 'secret_key', vaultEnvironment);
      toast({
        title: 'PayPal connected',
        description: savedRole?.last4
          ? `Connected. Ending in ${savedRole.last4}.`
          : 'Credentials saved.',
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Failed to save PayPal credentials.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDeleting(true);
    try {
      const data = await deletePaypalCredentials();
      setStatus(data);
      setEnabled(false);
      setCustomSettings((previous) => ({
        ...previous,
        paypal_enabled: false,
      }));
      setConfirmOpen(false);
      toast({
        title: 'PayPal disconnected',
        description: 'Your PayPal credentials have been removed.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to disconnect',
        description:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-5" />
          PayPal Checkout
        </CardTitle>
        <CardDescription>
          Accept international payments via PayPal. Buyers can pay securely with
          their PayPal account or cards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h3 className="font-semibold">Enable PayPal Checkout</h3>
            <p className="text-sm text-muted-foreground">
              {isConnectedForMode
                ? 'Display the PayPal button at storefront checkout.'
                : 'Connect a PayPal account below to turn this on.'}
            </p>
          </div>
          <Switch
            aria-label="Enable PayPal Checkout"
            checked={canEnable && enabled}
            disabled={!canEnable || togglePending}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        <PaypalConnectionForm
          mode={mode}
          modePending={modePending}
          onModeChange={handleModeChange}
          isConnectedForMode={isConnectedForMode}
          last4={secretRole?.last4 ?? null}
          reconnectError={reconnectError}
          clientId={clientId}
          onClientIdChange={setClientId}
          secretKey={secretKey}
          onSecretKeyChange={setSecretKey}
          saving={saving}
          saveError={saveError}
          onSave={handleSaveCredentials}
        />

        {isConnectedForMode && (
          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              Disconnect PayPal
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect PayPal?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your saved PayPal credentials for every environment
              and turns off PayPal at checkout. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
