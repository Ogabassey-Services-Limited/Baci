'use client';

import {
  AlertCircle,
  Check,
  Gift,
  Loader2,
  Phone,
  Plus,
  Settings,
  ShoppingCart,
  TrendingUp,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VTUSettings {
  vtu_enabled: boolean;
  vtu_airtime_enabled: boolean;
  vtu_data_enabled: boolean;
  vtu_checkout_addon_enabled: boolean;
  vtu_checkout_addon_amounts: number[];
  vtu_loyalty_reward_enabled: boolean;
  vtu_merchant_commission_rate: number;
}

const DEFAULT_SETTINGS: VTUSettings = {
  vtu_enabled: false,
  vtu_airtime_enabled: true,
  vtu_data_enabled: true,
  vtu_checkout_addon_enabled: false,
  vtu_checkout_addon_amounts: [100, 200, 500, 1000],
  vtu_loyalty_reward_enabled: false,
  vtu_merchant_commission_rate: 0.5,
};

export default function VTUSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<VTUSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/merchant/features');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            vtu_enabled: data.vtu_enabled ?? false,
            vtu_airtime_enabled: data.vtu_airtime_enabled ?? true,
            vtu_data_enabled: data.vtu_data_enabled ?? true,
            vtu_checkout_addon_enabled:
              data.vtu_checkout_addon_enabled ?? false,
            vtu_checkout_addon_amounts: data.vtu_checkout_addon_amounts || [
              100, 200, 500, 1000,
            ],
            vtu_loyalty_reward_enabled:
              data.vtu_loyalty_reward_enabled ?? false,
            vtu_merchant_commission_rate:
              data.vtu_merchant_commission_rate ?? 0.5,
          });
        }
      } catch (error) {
        console.error('Failed to fetch VTU settings:', error);
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
        toast({
          title: 'Settings Saved',
          description: 'VTU settings have been updated.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save VTU settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const addAmount = () => {
    const amount = Number.parseInt(newAmount, 10);
    if (
      amount >= 50 &&
      amount <= 10000 &&
      !settings.vtu_checkout_addon_amounts.includes(amount)
    ) {
      setSettings({
        ...settings,
        vtu_checkout_addon_amounts: [
          ...settings.vtu_checkout_addon_amounts,
          amount,
        ].sort((a, b) => a - b),
      });
      setNewAmount('');
    }
  };

  const removeAmount = (amount: number) => {
    setSettings({
      ...settings,
      vtu_checkout_addon_amounts: settings.vtu_checkout_addon_amounts.filter(
        (a) => a !== amount
      ),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">VTU Services</h1>
        <p className="text-muted-foreground">
          Enable airtime and data purchases for your customers. Earn commission
          on every sale.
        </p>
      </div>

      {/* Status Banner */}
      {!settings.vtu_enabled && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">VTU Services Disabled</p>
            <p className="text-sm">
              Enable VTU below to let customers buy airtime and data.
            </p>
          </div>
        </div>
      )}

      {settings.vtu_enabled && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
          <Check className="h-5 w-5" />
          <div>
            <p className="font-medium">VTU Services Active</p>
            <p className="text-sm">
              Customers can purchase airtime and data from your store.
            </p>
          </div>
        </div>
      )}

      {/* Main Toggle Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Enable VTU Services
          </CardTitle>
          <CardDescription>
            Allow customers to purchase airtime and data bundles directly from
            your store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              settings.vtu_enabled
                ? 'border-green-200 bg-green-50/50'
                : 'border-gray-200'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">VTU (Value Top-Up)</h3>
                  <p className="text-sm text-muted-foreground">
                    Powered by Kuda. Sell MTN, Airtel, Glo, 9mobile airtime &
                    data.
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      1.5% Cashback
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Instant Delivery
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      All Networks
                    </span>
                  </div>
                </div>
              </div>
              <Switch
                checked={settings.vtu_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, vtu_enabled: checked })
                }
              />
            </div>
          </div>

          {settings.vtu_enabled && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Airtime Toggle */}
              <div
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  settings.vtu_airtime_enabled
                    ? 'border-green-200 bg-green-50/30'
                    : 'border-gray-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-green-600" />
                    <div>
                      <h4 className="font-medium">Airtime</h4>
                      <p className="text-xs text-muted-foreground">
                        Enable airtime purchases
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.vtu_airtime_enabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, vtu_airtime_enabled: checked })
                    }
                  />
                </div>
              </div>

              {/* Data Toggle */}
              <div
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  settings.vtu_data_enabled
                    ? 'border-green-200 bg-green-50/30'
                    : 'border-gray-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium">Data Bundles</h4>
                      <p className="text-xs text-muted-foreground">
                        Enable data purchases
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.vtu_data_enabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, vtu_data_enabled: checked })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checkout Add-ons Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Checkout Add-ons
          </CardTitle>
          <CardDescription>
            Show quick airtime purchase options at checkout. Increase average
            order value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Plus className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium">Add Airtime to Order</h4>
                <p className="text-sm text-muted-foreground">
                  Show &quot;Add ₦500 airtime to your order?&quot; at checkout
                </p>
              </div>
            </div>
            <Switch
              checked={settings.vtu_checkout_addon_enabled}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  vtu_checkout_addon_enabled: checked,
                })
              }
              disabled={!settings.vtu_enabled}
            />
          </div>

          {settings.vtu_checkout_addon_enabled && (
            <div className="space-y-4">
              <Label>Quick Add Amounts</Label>
              <div className="flex flex-wrap gap-2">
                {settings.vtu_checkout_addon_amounts.map((amount) => (
                  <Badge
                    key={amount}
                    variant="secondary"
                    className="px-3 py-1 text-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeAmount(amount)}
                  >
                    ₦{amount.toLocaleString()}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Add amount (e.g., 2000)"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  min={50}
                  max={10000}
                  className="w-48"
                />
                <Button variant="outline" size="sm" onClick={addAmount}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click on an amount to remove it. Min: ₦50, Max: ₦10,000
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loyalty Rewards Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Loyalty Rewards
          </CardTitle>
          <CardDescription>
            Let customers redeem loyalty points for airtime. Great for customer
            retention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">Airtime as Rewards</h4>
                <p className="text-sm text-muted-foreground">
                  Customers can redeem points for airtime
                </p>
              </div>
            </div>
            <Switch
              checked={settings.vtu_loyalty_reward_enabled}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  vtu_loyalty_reward_enabled: checked,
                })
              }
              disabled={!settings.vtu_enabled}
            />
          </div>
          {settings.vtu_loyalty_reward_enabled && (
            <p className="mt-4 text-sm text-muted-foreground">
              Configure airtime rewards in the{' '}
              <a href="/dashboard/loyalty" className="text-primary underline">
                Loyalty Program
              </a>{' '}
              settings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Commission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Commission & Earnings
          </CardTitle>
          <CardDescription>
            Earn commission on every VTU sale. Kuda provides up to 5% commission
            depending on provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium">Your Commission Split</h4>
                <p className="text-sm text-muted-foreground">
                  You receive {settings.vtu_merchant_commission_rate}% of
                  Kuda&apos;s commission
                </p>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {settings.vtu_merchant_commission_rate}% split
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Network</th>
                    <th className="text-center py-2 font-medium">Kuda Rate</th>
                    <th className="text-center py-2 font-medium">You Earn</th>
                    <th className="text-center py-2 font-medium">Platform</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">MTN / Airtel</td>
                    <td className="text-center text-green-600 font-medium">
                      3%
                    </td>
                    <td className="text-center text-blue-600">
                      {(
                        (3 * settings.vtu_merchant_commission_rate) /
                        100
                      ).toFixed(1)}
                      %
                    </td>
                    <td className="text-center text-purple-600">
                      {(
                        (3 * (100 - settings.vtu_merchant_commission_rate)) /
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Glo</td>
                    <td className="text-center text-green-600 font-medium">
                      4%
                    </td>
                    <td className="text-center text-blue-600">
                      {(
                        (4 * settings.vtu_merchant_commission_rate) /
                        100
                      ).toFixed(1)}
                      %
                    </td>
                    <td className="text-center text-purple-600">
                      {(
                        (4 * (100 - settings.vtu_merchant_commission_rate)) /
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2">9mobile</td>
                    <td className="text-center text-green-600 font-medium">
                      5%
                    </td>
                    <td className="text-center text-blue-600">
                      {(
                        (5 * settings.vtu_merchant_commission_rate) /
                        100
                      ).toFixed(1)}
                      %
                    </td>
                    <td className="text-center text-purple-600">
                      {(
                        (5 * (100 - settings.vtu_merchant_commission_rate)) /
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Example Earnings
            </h4>
            <p className="text-sm text-blue-700">
              For every ₦10,000 MTN airtime sold (3% = ₦300 commission):
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Kuda commission: ₦300 (3%)</li>
              <li>
                • Your earnings: ₦
                {(
                  (300 * settings.vtu_merchant_commission_rate) /
                  100
                ).toLocaleString()}{' '}
                ({settings.vtu_merchant_commission_rate}% of ₦300)
              </li>
              <li>
                • Platform: ₦
                {(
                  (300 * (100 - settings.vtu_merchant_commission_rate)) /
                  100
                ).toLocaleString()}{' '}
                ({100 - settings.vtu_merchant_commission_rate}% of ₦300)
              </li>
            </ul>
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
