import { CreditCard, Truck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { PaymentGatewaySettings } from '../payment-settings';

type PaymentGatewayCardsProps = {
  hasPaystackSubaccount: boolean;
  isPaystackSupported: boolean;
  onSettingsChange: (settings: PaymentGatewaySettings) => void;
  paystackFixedFee: string;
  settings: PaymentGatewaySettings;
};

/** Controls merchant gateway availability and opt-in payment methods. */
export function PaymentGatewayCards({
  hasPaystackSubaccount,
  isPaystackSupported,
  onSettingsChange,
  paystackFixedFee,
  settings,
}: PaymentGatewayCardsProps) {
  return (
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
              aria-label="Toggle Paystack"
              checked={isPaystackSupported && settings.paystack_enabled}
              disabled={!isPaystackSupported || !hasPaystackSubaccount}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, paystack_enabled: checked })
              }
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
                onSettingsChange({
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
                  Multi-currency support. Best for international payments across
                  Africa.
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
              aria-label="Toggle Korapay"
              checked={settings.korapay_enabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, korapay_enabled: checked })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
