'use client';

import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  Globe,
  Loader2,
  RefreshCw,
  Truck,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MerchantBankForm } from '@/components/merchant-bank-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import { formatCurrencyCompact, getCurrencyCode } from '@/lib/currency';
import { cn } from '@/lib/utils';
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

  if (!response.ok) {
    throw new Error('Failed to save settings');
  }

  // Check for onboarding flow
  const params = new URLSearchParams(window.location.search);
  if (params.get('onboarding') === 'true') {
    window.location.href = '/dashboard?setup_complete=payments';
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
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const merchantData = merchant as unknown as Record<string, unknown> | null;
  const countryCode =
    typeof merchantData?.country === 'string' ? merchantData.country : null;
  const isPaystackSupported = isBaciPaystackSettlementCountry(countryCode);
  const hasPaystackSubaccount = !!merchantData?.paystack_subaccount_code;
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
        if (isStale) return;
        setLoading(false);
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
        // Keep the button disabled while the browser navigates away.
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Payment Settings
          </h1>
          <p className="text-muted-foreground">
            Configure payment gateways, delivery payments, and settlement
            details
          </p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {loadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={retryLoad}
            >
              <RefreshCw className="size-4 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground">
          Configure payment gateways, delivery payments, and settlement details
        </p>
      </div>

      {/* Bank Details Card */}
      {isPaystackSupported ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Bank Settlement Details
            </CardTitle>
            <CardDescription>
              Add your bank account to receive payments directly via Paystack
              split payments (T+1 settlement).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPaystackSubaccount ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
                  <Check className="size-5" />
                  <div>
                    <p className="font-medium">Bank Account Connected</p>
                    <p className="text-sm">
                      Paystack subaccount is configured for automatic
                      settlements
                    </p>
                  </div>
                </div>
                <MerchantBankForm
                  countryCode={countryCode}
                  initialData={{
                    bankCode: merchantData?.bank_code as string,
                    bankName: merchantData?.bank_name as string,
                    accountName: merchantData?.bank_account_name as string,
                    accountNumber: merchantData?.bank_account_number as string,
                    businessName: merchant?.business_name,
                  }}
                  onSuccess={reloadMerchant}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
                  <AlertCircle className="size-5" />
                  <div>
                    <p className="font-medium">Bank Account Required</p>
                    <p className="text-sm">
                      Add your bank details to enable Paystack payments with
                      automatic settlement
                    </p>
                  </div>
                </div>
                <MerchantBankForm
                  countryCode={countryCode}
                  initialData={{
                    businessName: merchant?.business_name,
                  }}
                  onSuccess={reloadMerchant}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Manual Invoice Bank Details
            </CardTitle>
            <CardDescription>
              Save bank details that appear on unpaid invoices and receipts.
              Baci-managed Paystack settlement is currently available only for
              Nigerian merchants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MerchantBankForm
              countryCode={countryCode}
              initialData={{
                bankName: merchantData?.bank_name as string,
                accountName: merchantData?.bank_account_name as string,
                accountNumber: merchantData?.bank_account_number as string,
                businessName: merchant?.business_name,
              }}
              onSuccess={reloadMerchant}
            />
          </CardContent>
        </Card>
      )}

      {/* Payment Gateways Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Payment Gateways
          </CardTitle>
          <CardDescription>
            Enable or disable payment gateways for your store. Each gateway has
            different features and settlement times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paystack */}
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              isPaystackSupported && settings.paystack_enabled
                ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                : 'border-gray-200 dark:border-gray-800'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-[#00C3F7] flex items-center justify-center text-white font-bold text-sm">
                  PS
                </div>
                <div>
                  <h3 className="font-semibold">Paystack</h3>
                  <p className="text-sm text-muted-foreground">
                    Best for Nigerian payments. Supports cards, bank transfers,
                    USSD.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      T+1 Settlement
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      Auto-Split
                    </span>
                    {isPaystackSupported && (
                      <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        1.5% + {paystackFixedFee}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Switch
                checked={isPaystackSupported && settings.paystack_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, paystack_enabled: checked })
                }
                disabled={!isPaystackSupported || !hasPaystackSubaccount}
              />
            </div>
            {!isPaystackSupported && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                Paystack is not available for this country yet. Use Pay on
                Delivery or request another online payment provider.
              </p>
            )}
            {!hasPaystackSubaccount && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                {isPaystackSupported
                  ? 'Add bank details above to enable Paystack'
                  : 'Paystack setup is disabled for this country'}
              </p>
            )}
          </div>

          {/* Pay on Delivery */}
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              settings.pay_on_delivery_enabled
                ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                : 'border-gray-200 dark:border-gray-800'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-[#F59E0B] flex items-center justify-center text-white">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Pay on Delivery</h3>
                  <p className="text-sm text-muted-foreground">
                    Let customers place orders online and pay when they receive
                    their items.
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      Offline Payment
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                      No Gateway Required
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      Manual Confirmation
                    </span>
                  </div>
                </div>
              </div>
              <Switch
                aria-label="Toggle Pay on Delivery"
                checked={settings.pay_on_delivery_enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    pay_on_delivery_enabled: checked,
                  })
                }
              />
            </div>
            {!isPaystackSupported && (
              <p className="text-xs text-muted-foreground mt-2">
                Recommended while Baci-managed online payment providers are not
                configured for your country.
              </p>
            )}
          </div>

          {/* Korapay */}
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              settings.korapay_enabled
                ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                : 'border-gray-200 dark:border-gray-800'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-[#6366F1] flex items-center justify-center text-white font-bold text-sm">
                  KP
                </div>
                <div>
                  <h3 className="font-semibold">Korapay</h3>
                  <p className="text-sm text-muted-foreground">
                    Multi-currency support. Best for international payments
                    across Africa.
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                      Instant Bank Transfer
                    </span>
                    <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full">
                      Multi-Currency
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      Multi-country
                    </span>
                  </div>
                </div>
              </div>
              <Switch
                checked={settings.korapay_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, korapay_enabled: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Virtual Terminal Section */}
      <VirtualTerminalSettings businessName={merchant?.business_name} />

      {/* Credit Direct BNPL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            Buy Now, Pay Later (BNPL)
          </CardTitle>
          <CardDescription>
            Let customers split payments into installments. You receive full
            payment from Credit Direct.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              settings.credit_direct_enabled
                ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                : 'border-gray-200 dark:border-gray-800'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  CD
                </div>
                <div>
                  <h3 className="font-semibold">Credit Direct</h3>
                  <p className="text-sm text-muted-foreground">
                    Customers pay in installments. You get paid in full
                    instantly.
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      Pay Later
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                      Instant Merchant Payment
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      No Interest for Customers
                    </span>
                  </div>
                </div>
              </div>
              <Switch
                checked={settings.credit_direct_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, credit_direct_enabled: checked })
                }
              />
            </div>
          </div>

          {/* Credit Direct Info */}
          <div className="p-4 rounded-lg bg-muted/50 border mt-4">
            <h4 className="font-medium mb-2">How BNPL Works</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>1. Customer selects &quot;Pay Later&quot; at checkout</li>
              <li>2. Credit Direct approves the customer instantly</li>
              <li>3. Customer pays 25-40% upfront, rest in installments</li>
              <li>4. You receive the full order amount from Credit Direct</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Gateway Preferences
          </CardTitle>
          <CardDescription>
            Choose which gateway to use by default for local and international
            payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Local Payments ({merchantCurrencyCode})</Label>
              <Select
                value={settings.preferred_local_gateway}
                onValueChange={(value: 'paystack' | 'korapay') =>
                  setSettings({ ...settings, preferred_local_gateway: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="paystack"
                    disabled={!isPaystackSupported || !hasPaystackSubaccount}
                  >
                    Paystack{' '}
                    {!isPaystackSupported
                      ? '(Unavailable)'
                      : !hasPaystackSubaccount
                        ? '(Add bank details)'
                        : ''}
                  </SelectItem>
                  <SelectItem value="korapay">Korapay</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for {merchantCurrencyCode} payments in your storefront
              </p>
            </div>

            <div className="space-y-2">
              <Label>International Payments</Label>
              <Select
                value={settings.preferred_international_gateway}
                onValueChange={(value: 'paystack' | 'korapay') =>
                  setSettings({
                    ...settings,
                    preferred_international_gateway: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="korapay">Korapay (Recommended)</SelectItem>
                  <SelectItem
                    value="paystack"
                    disabled={!isPaystackSupported || !hasPaystackSubaccount}
                  >
                    Paystack{' '}
                    {!isPaystackSupported
                      ? '(Unavailable)'
                      : !hasPaystackSubaccount
                        ? '(Add bank details)'
                        : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for cross-border and provider-supported currencies
              </p>
            </div>
          </div>

          {/* Platform Fee Info */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2">Platform Fee</h4>
            <p className="text-sm text-muted-foreground">
              Baci charges{' '}
              <strong>
                {platformFeeCap
                  ? `2% per transaction, capped at ${platformFeeCap}`
                  : '2% per transaction'}
              </strong>
              . This is automatically deducted from each payment.{' '}
              {isPaystackSupported
                ? `Gateway fees (Paystack: 1.5% + ${paystackFixedFee}) are separate and borne by the platform.`
                : 'Gateway fees depend on the provider configured for your country.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
