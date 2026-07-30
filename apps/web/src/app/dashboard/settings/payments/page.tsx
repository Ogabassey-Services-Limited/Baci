'use client';

import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import { formatCurrencyCompact, getCurrencyCode } from '@/lib/currency';
import { MerchantSettlementCard } from './components/merchant-settlement-card';
import { PaymentGatewayCards } from './components/payment-gateway-cards';
import { PaymentPreferencesCard } from './components/payment-preferences-card';
import { VirtualTerminalSettings } from './components/virtual-terminal-settings';
import { fetchPaymentSettings } from './fetch-payment-settings';
import {
  DEFAULT_PAYMENT_SETTINGS,
  type PaymentGatewaySettings,
} from './payment-settings';

async function savePaymentSettings(
  settings: PaymentGatewaySettings,
  isPaystackSupported: boolean
): Promise<'saved' | 'redirecting'> {
  const response = await fetchWithCsrf('/api/merchant/features', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...settings,
      paystack_enabled: isPaystackSupported ? settings.paystack_enabled : false,
      preferred_local_gateway:
        !isPaystackSupported && settings.preferred_local_gateway === 'paystack'
          ? 'korapay'
          : settings.preferred_local_gateway,
      preferred_international_gateway:
        !isPaystackSupported &&
        settings.preferred_international_gateway === 'paystack'
          ? 'korapay'
          : settings.preferred_international_gateway,
    }),
  });
  if (!response.ok) throw new Error('Failed to save settings');

  if (
    new URLSearchParams(window.location.search).get('onboarding') === 'true'
  ) {
    window.location.href = '/dashboard?setup_complete=payments';
    return 'redirecting';
  }
  return 'saved';
}

function PaymentSettingsHeading() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
      <p className="text-muted-foreground">
        Configure payment gateways, delivery payments, and settlement details
      </p>
    </div>
  );
}

export default function PaymentSettingsPage() {
  const { toast } = useToast();
  const { merchant, loading: merchantLoading, reloadMerchant } = useMerchant();
  const [settings, setSettings] = useState<PaymentGatewaySettings>(
    DEFAULT_PAYMENT_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);

  const countryCode = merchant?.country ?? null;
  const isPaystackSupported = isBaciPaystackSettlementCountry(countryCode);
  const hasPaystackSubaccount = Boolean(merchant?.paystack_subaccount_code);
  const merchantCurrencyCode = getCurrencyCode(countryCode);
  const platformFeeCap = isPaystackSupported
    ? formatCurrencyCompact(2050, 'NG')
    : null;
  const paystackFixedFee = formatCurrencyCompact(100, 'NG');

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken intentionally retriggers the load on retry
  useEffect(() => {
    let isStale = false;
    fetchPaymentSettings()
      .then((fetchedSettings) => {
        if (isStale) return;
        if (fetchedSettings) {
          setSettings(fetchedSettings);
          setLoadError(null);
        } else {
          setLoadError('Failed to load payment settings.');
        }
      })
      .catch((error: unknown) => {
        if (isStale) return;
        console.error('Failed to fetch payment settings:', error);
        setLoadError('Failed to load payment settings.');
      })
      .finally(() => {
        if (!isStale) setLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [reloadToken]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  };

  const handleSave = () => {
    setSaving(true);
    savePaymentSettings(settings, isPaystackSupported)
      .then((outcome) => {
        if (outcome === 'redirecting') return;
        toast({
          title: 'Settings Saved',
          description: 'Payment gateway settings have been updated.',
        });
        setSaving(false);
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save payment settings.',
        });
        setSaving(false);
      });
  };

  if (loading || merchantLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PaymentSettingsHeading />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {loadError}
            </p>
            <Button
              className="mt-3"
              onClick={retryLoad}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-4 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="space-y-6">
        <PaymentSettingsHeading />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Merchant context is unavailable. Refresh and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PaymentSettingsHeading />
      <MerchantSettlementCard
        isPaystackSupported={isPaystackSupported}
        merchant={{
          accountName: merchant.bank_account_name ?? null,
          accountNumber: merchant.bank_account_number ?? null,
          bankCode: merchant.bank_code ?? null,
          bankName: merchant.bank_name ?? null,
          businessName: merchant.business_name ?? null,
          countryCode,
          id: merchant.id,
          paystackSubaccountCode: merchant.paystack_subaccount_code ?? null,
        }}
        onBankSaved={reloadMerchant}
      />
      <PaymentGatewayCards
        hasPaystackSubaccount={hasPaystackSubaccount}
        isPaystackSupported={isPaystackSupported}
        onSettingsChange={setSettings}
        paystackFixedFee={paystackFixedFee}
        settings={settings}
      />
      <VirtualTerminalSettings businessName={merchant.business_name} />
      <PaymentPreferencesCard
        hasPaystackSubaccount={hasPaystackSubaccount}
        isPaystackSupported={isPaystackSupported}
        merchantCurrencyCode={merchantCurrencyCode}
        onSettingsChange={setSettings}
        paystackFixedFee={paystackFixedFee}
        platformFeeCap={platformFeeCap}
        settings={settings}
      />
      <div className="flex justify-end">
        <Button disabled={saving} onClick={handleSave}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
