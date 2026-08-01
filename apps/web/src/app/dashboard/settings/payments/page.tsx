'use client';

import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { PaymentSettingsHeading } from './payment-settings-heading';
import { usePaymentBankCompletion } from './use-payment-bank-completion';

async function savePaymentSettings(
  settings: PaymentGatewaySettings,
  isPaystackSupported: boolean,
  merchantId: string
): Promise<'saved' | 'redirecting'> {
  const response = await fetchWithCsrf('/api/merchant/features', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantId,
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
    return 'redirecting';
  }
  return 'saved';
}

export default function PaymentSettingsPage() {
  const { toast } = useToast();
  const { merchant, loading: merchantLoading, reloadMerchant } = useMerchant();
  const [settings, setSettings] = useState<PaymentGatewaySettings>(
    DEFAULT_PAYMENT_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedMerchantId, setLoadedMerchantId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [savingMerchantId, setSavingMerchantId] = useState<string | null>(null);
  const saveEpochRef = useRef(0);
  const currentMerchantIdRef = useRef<string | null>(null);
  const { handleBankSaved, merchantRevision, savedBank } =
    usePaymentBankCompletion(merchant?.id, reloadMerchant);

  // Keep async callbacks bound to the last committed merchant. Updating this
  // during render leaks a speculative identity from an abandoned render.
  useLayoutEffect(() => {
    currentMerchantIdRef.current = merchant?.id ?? null;
  }, [merchant?.id]);

  const countryCode = merchant?.country ?? null;
  const isPaystackSupported = isBaciPaystackSettlementCountry(countryCode);
  const hasPaystackSubaccount = Boolean(
    merchant?.paystack_subaccount_code ||
      merchant?.paystack_subaccount_configured === true ||
      savedBank
  );
  const merchantCurrencyCode = getCurrencyCode(countryCode);
  const platformFeeCap = isPaystackSupported
    ? formatCurrencyCompact(2050, 'NG')
    : null;
  const paystackFixedFee = formatCurrencyCompact(100, 'NG');
  const hasCurrentMerchantSettings = loadedMerchantId === merchant?.id;
  const isSavingCurrentMerchant = savingMerchantId === merchant?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken intentionally retriggers the load on retry
  useEffect(() => {
    if (!merchant?.id) {
      saveEpochRef.current += 1;
      setSettings(DEFAULT_PAYMENT_SETTINGS);
      setLoadedMerchantId(null);
      setSavingMerchantId(null);
      setLoading(false);
      return;
    }

    let isStale = false;
    const merchantId = merchant.id;
    saveEpochRef.current += 1;
    setLoading(true);
    setLoadError(null);
    setLoadedMerchantId(null);
    setSavingMerchantId(null);
    setSettings(DEFAULT_PAYMENT_SETTINGS);
    fetchPaymentSettings(merchantId)
      .then((fetchedSettings) => {
        if (isStale) return;
        if (fetchedSettings) {
          setSettings(fetchedSettings);
          setLoadedMerchantId(merchantId);
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
  }, [merchant?.id, reloadToken]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  };

  const handleSave = () => {
    if (!merchant || !hasCurrentMerchantSettings) return;

    const merchantId = merchant.id;
    const saveEpoch = saveEpochRef.current;
    setSavingMerchantId(merchantId);
    savePaymentSettings(settings, isPaystackSupported, merchantId)
      .then((outcome) => {
        if (
          saveEpochRef.current !== saveEpoch ||
          currentMerchantIdRef.current !== merchantId
        ) {
          return;
        }
        if (outcome === 'redirecting') {
          window.location.href = '/dashboard?setup_complete=payments';
          return;
        }
        toast({
          title: 'Settings Saved',
          description: 'Payment gateway settings have been updated.',
        });
        setSavingMerchantId(null);
      })
      .catch(() => {
        if (
          saveEpochRef.current !== saveEpoch ||
          currentMerchantIdRef.current !== merchantId
        ) {
          return;
        }
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save payment settings.',
        });
        setSavingMerchantId(null);
      });
  };

  if (
    loading ||
    merchantLoading ||
    (Boolean(merchant?.id) && !hasCurrentMerchantSettings && !loadError)
  ) {
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
        hasPaystackSubaccount={hasPaystackSubaccount}
        isPaystackSupported={isPaystackSupported}
        merchant={{
          accountName:
            savedBank?.accountName ?? merchant.bank_account_name ?? null,
          accountNumber:
            savedBank?.accountNumber ?? merchant.bank_account_number ?? null,
          bankCode: savedBank?.bankCode ?? merchant.bank_code ?? null,
          bankName: savedBank?.bankName ?? merchant.bank_name ?? null,
          businessName:
            savedBank?.businessName ?? merchant.business_name ?? null,
          countryCode,
          id: merchant.id,
          paystackSubaccountCode: merchant.paystack_subaccount_code ?? null,
        }}
        onBankSaved={(bank) =>
          handleBankSaved(merchant.id, merchantRevision, bank)
        }
      />
      <PaymentGatewayCards
        hasPaystackSubaccount={hasPaystackSubaccount}
        isPaystackSupported={isPaystackSupported}
        onSettingsChange={setSettings}
        paystackFixedFee={paystackFixedFee}
        settings={settings}
      />
      <VirtualTerminalSettings
        businessName={merchant.business_name}
        merchantId={merchant.id}
      />
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
        <Button
          disabled={isSavingCurrentMerchant || !hasCurrentMerchantSettings}
          onClick={handleSave}
        >
          {isSavingCurrentMerchant && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
