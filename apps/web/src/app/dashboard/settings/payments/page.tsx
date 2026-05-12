'use client';

import {
  AlertCircle,
  Building2,
  Check,
  CreditCard,
  Globe,
  Loader2,
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
import { cn } from '@/lib/utils';
import { VirtualTerminalSettings } from './components/virtual-terminal-settings';

interface PaymentGatewaySettings {
  paystack_enabled: boolean;
  korapay_enabled: boolean;
  preferred_local_gateway: 'paystack' | 'korapay';
  preferred_international_gateway: 'paystack' | 'korapay';
  // Credit Direct BNPL
  credit_direct_enabled: boolean;
}

const DEFAULT_SETTINGS: PaymentGatewaySettings = {
  paystack_enabled: true,
  korapay_enabled: true,
  preferred_local_gateway: 'paystack',
  preferred_international_gateway: 'korapay',
  // Credit Direct BNPL defaults
  credit_direct_enabled: false,
};

export default function PaymentSettingsPage() {
  const { toast } = useToast();
  const { merchant, loading: merchantLoading } = useMerchant();
  const [settings, setSettings] =
    useState<PaymentGatewaySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/merchant/features');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            paystack_enabled: data.paystack_enabled ?? true,
            korapay_enabled: data.korapay_enabled ?? true,
            preferred_local_gateway: data.preferred_local_gateway || 'paystack',
            preferred_international_gateway:
              data.preferred_international_gateway || 'korapay',
            // Credit Direct BNPL
            credit_direct_enabled: data.credit_direct_enabled ?? false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch payment settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/merchant/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        // Check for onboarding flow
        const params = new URLSearchParams(window.location.search);
        if (params.get('onboarding') === 'true') {
          window.location.href = '/dashboard?setup_complete=payments';
          return;
        }

        toast({
          title: 'Settings Saved',
          description: 'Payment gateway settings have been updated.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save payment settings.',
      });
    } finally {
      if (!window.location.search.includes('onboarding=true')) {
        setSaving(false);
      }
    }
  };

  // Cast merchant to access additional fields not in base type
  const merchantData = merchant as unknown as Record<string, unknown> | null;
  const hasPaystackSubaccount = !!merchantData?.paystack_subaccount_code;

  if (loading || merchantLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground">
          Configure payment gateways and bank settlement details
        </p>
      </div>

      {/* Bank Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
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
                <Check className="h-5 w-5" />
                <div>
                  <p className="font-medium">Bank Account Connected</p>
                  <p className="text-sm">
                    Paystack subaccount is configured for automatic settlements
                  </p>
                </div>
              </div>
              <MerchantBankForm
                initialData={{
                  bankCode: merchantData?.bank_code as string,
                  accountNumber: merchantData?.bank_account_number as string,
                  businessName: merchant?.business_name,
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Bank Account Required</p>
                  <p className="text-sm">
                    Add your bank details to enable Paystack payments with
                    automatic settlement
                  </p>
                </div>
              </div>
              <MerchantBankForm />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Gateways Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
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
              settings.paystack_enabled
                ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
                : 'border-gray-200 dark:border-gray-800'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00C3F7] flex items-center justify-center text-white font-bold text-sm">
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
                    <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full">
                      1.5% + N100
                    </span>
                  </div>
                </div>
              </div>
              <Switch
                checked={settings.paystack_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, paystack_enabled: checked })
                }
                disabled={!hasPaystackSubaccount}
              />
            </div>
            {!hasPaystackSubaccount && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                Add bank details above to enable Paystack
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
                <div className="w-10 h-10 rounded-lg bg-[#6366F1] flex items-center justify-center text-white font-bold text-sm">
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
                      NGN, KES, GHS, ZAR
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
            <Wallet className="h-5 w-5" />
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
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
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
            <Globe className="h-5 w-5" />
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
              <Label>Local Payments (NGN)</Label>
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
                    disabled={!hasPaystackSubaccount}
                  >
                    Paystack {!hasPaystackSubaccount && '(Add bank details)'}
                  </SelectItem>
                  <SelectItem value="korapay">Korapay</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for Nigerian Naira (NGN) payments
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
                    disabled={!hasPaystackSubaccount}
                  >
                    Paystack {!hasPaystackSubaccount && '(Add bank details)'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for KES, GHS, ZAR, and other currencies
              </p>
            </div>
          </div>

          {/* Platform Fee Info */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2">Platform Fee</h4>
            <p className="text-sm text-muted-foreground">
              Baci charges <strong>2% per transaction, capped at N2,050</strong>
              . This is automatically deducted from each payment. Gateway fees
              (Paystack: 1.5% + N100) are separate and borne by the platform.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
