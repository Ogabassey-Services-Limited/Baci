'use client';

import { Gift, Plus, ShoppingCart, X } from 'lucide-react';
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
import type { VTUSettings } from './vtu-settings-types';

interface VtuCustomerOptionsCardsProps {
  addAmount: () => void;
  newAmount: string;
  removeAmount: (amount: number) => void;
  setNewAmount: (amount: string) => void;
  setSettings: (settings: VTUSettings) => void;
  settings: VTUSettings;
}

export function VtuCustomerOptionsCards({
  addAmount,
  newAmount,
  removeAmount,
  setNewAmount,
  setSettings,
  settings,
}: VtuCustomerOptionsCardsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
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
              <div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Plus className="size-5 text-orange-600" />
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
              disabled={!settings.vtu_enabled}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  vtu_checkout_addon_enabled: checked,
                })
              }
            />
          </div>

          {settings.vtu_checkout_addon_enabled && (
            <div className="space-y-4">
              <Label>Quick Add Amounts</Label>
              <div className="flex flex-wrap gap-2">
                {settings.vtu_checkout_addon_amounts.map((amount) => (
                  <Badge
                    className="px-3 py-1 text-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    key={amount}
                    onClick={() => removeAmount(amount)}
                    variant="secondary"
                  >
                    ₦{amount.toLocaleString()}
                    <X className="size-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  className="w-48"
                  max={10000}
                  min={50}
                  onChange={(event) => setNewAmount(event.target.value)}
                  placeholder="Add amount (e.g., 2000)"
                  type="number"
                  value={newAmount}
                />
                <Button onClick={addAmount} size="sm" variant="outline">
                  <Plus className="size-4 mr-1" />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-5" />
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
              <div className="size-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Gift className="size-5 text-purple-600" />
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
              disabled={!settings.vtu_enabled}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  vtu_loyalty_reward_enabled: checked,
                })
              }
            />
          </div>
          {settings.vtu_loyalty_reward_enabled && (
            <p className="mt-4 text-sm text-muted-foreground">
              Configure airtime rewards in the{' '}
              <a className="text-primary underline" href="/dashboard/loyalty">
                Loyalty Program
              </a>{' '}
              settings.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
