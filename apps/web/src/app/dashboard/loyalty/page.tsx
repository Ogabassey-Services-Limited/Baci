'use client';

import { Award, Gift } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BagLoader } from '@/components/ui/bag-loader';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/currency';

interface LoyaltySettings {
  enabled: boolean;
  program_name: string;
  points_per_currency: number;
  points_currency_unit: number;
  signup_bonus_points: number;
  birthday_bonus_points: number;
  review_bonus_points: number;
  referral_bonus_points: number;
  points_to_currency_ratio: number;
  minimum_redemption_points: number;
  maximum_redemption_percentage: number;
  tiers: Array<{
    name: string;
    minPoints: number;
    multiplier: number;
    perks: string[];
  }>;
  points_expiry_days: number;
}

interface CustomerLoyalty {
  id: string;
  points_balance: number;
  lifetime_points: number;
  current_tier: string;
  referral_code: string;
  referral_count: number;
  customers: {
    id: string;
    name: string;
    email: string;
    phone: string;
    store_credit: number;
  } | null;
}

const tierColors: Record<string, string> = {
  Bronze: 'bg-amber-700 text-white',
  Silver: 'bg-gray-400 text-white',
  Gold: 'bg-yellow-500 text-white',
  Platinum: 'bg-purple-600 text-white',
};

export default function LoyaltyProgramPage() {
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [_customers, setCustomers] = useState<CustomerLoyalty[]>([]);
  const [_tierDistribution, setTierDistribution] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/loyalty/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch loyalty settings:', error);
    }
  };

  const fetchCustomers = async (tier?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (tier) params.set('tier', tier);

      const res = await fetch(`/api/loyalty/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setTierDistribution(data.stats?.tierDistribution || {});
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCustomers();
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler auto-memoizes these functions
  }, [fetchCustomers, fetchSettings]);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/loyalty/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        // Show success message
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <BagLoader size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loyalty Program</h1>
          <p className="text-muted-foreground">
            Reward your customers and build lasting relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings?.enabled || false}
            onCheckedChange={(checked) =>
              setSettings((s) => (s ? { ...s, enabled: checked } : null))
            }
            aria-label="Toggle loyalty program"
          />
          <span className="text-sm font-medium">
            {settings?.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="space-y-4">
          {settings && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Program Settings</CardTitle>
                  <CardDescription>
                    Configure how customers earn and redeem points
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="program_name">Program Name</Label>
                      <Input
                        id="program_name"
                        value={settings.program_name}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            program_name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="points_expiry">
                        Points Expiry (days)
                      </Label>
                      <Input
                        id="points_expiry"
                        type="number"
                        value={settings.points_expiry_days}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            points_expiry_days:
                              Number.parseInt(e.target.value, 10) || 365,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Set to 0 for no expiry
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Earning Rules</CardTitle>
                  <CardDescription>How customers earn points</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="points_per_currency">
                        Points per{' '}
                        {formatCurrency(settings.points_currency_unit)}
                      </Label>
                      <Input
                        id="points_per_currency"
                        type="number"
                        step="0.1"
                        value={settings.points_per_currency}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            points_per_currency:
                              Number.parseFloat(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency_unit">
                        Currency Unit ({formatCurrency(1)})
                      </Label>
                      <Input
                        id="currency_unit"
                        type="number"
                        value={settings.points_currency_unit}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            points_currency_unit:
                              Number.parseFloat(e.target.value) || 100,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup_bonus">Signup Bonus</Label>
                      <Input
                        id="signup_bonus"
                        type="number"
                        value={settings.signup_bonus_points}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            signup_bonus_points:
                              Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthday_bonus">Birthday Bonus</Label>
                      <Input
                        id="birthday_bonus"
                        type="number"
                        value={settings.birthday_bonus_points}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            birthday_bonus_points:
                              Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review_bonus">Review Bonus</Label>
                      <Input
                        id="review_bonus"
                        type="number"
                        value={settings.review_bonus_points}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            review_bonus_points:
                              Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="referral_bonus">Referral Bonus</Label>
                      <Input
                        id="referral_bonus"
                        type="number"
                        value={settings.referral_bonus_points}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            referral_bonus_points:
                              Number.parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Redemption Rules</CardTitle>
                  <CardDescription>How customers redeem points</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="points_ratio">
                        Points to Currency Ratio
                      </Label>
                      <Input
                        id="points_ratio"
                        type="number"
                        step="0.001"
                        value={settings.points_to_currency_ratio}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            points_to_currency_ratio:
                              Number.parseFloat(e.target.value) || 0.01,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        1 point ={' '}
                        {formatCurrency(settings.points_to_currency_ratio)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min_redemption">
                        Minimum Redemption Points
                      </Label>
                      <Input
                        id="min_redemption"
                        type="number"
                        value={settings.minimum_redemption_points}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            minimum_redemption_points:
                              Number.parseInt(e.target.value, 10) || 500,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_redemption">
                        Max % of Order with Points
                      </Label>
                      <Input
                        id="max_redemption"
                        type="number"
                        max={100}
                        value={settings.maximum_redemption_percentage}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            maximum_redemption_percentage:
                              Number.parseFloat(e.target.value) || 50,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Membership Tiers</CardTitle>
                  <CardDescription>
                    Define tier levels and benefits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {settings.tiers.map((tier, index) => (
                      <div
                        key={tier.name}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <Badge
                          className={tierColors[tier.name] || 'bg-gray-500'}
                        >
                          {tier.name}
                        </Badge>
                        <div className="flex-1 grid gap-4 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Min Points</Label>
                            <Input
                              type="number"
                              value={tier.minPoints}
                              onChange={(e) => {
                                const newTiers = [...settings.tiers];
                                newTiers[index].minPoints =
                                  Number.parseInt(e.target.value, 10) || 0;
                                setSettings({ ...settings, tiers: newTiers });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Points Multiplier</Label>
                            <Input
                              type="number"
                              step="0.25"
                              value={tier.multiplier}
                              onChange={(e) => {
                                const newTiers = [...settings.tiers];
                                newTiers[index].multiplier =
                                  Number.parseFloat(e.target.value) || 1;
                                setSettings({ ...settings, tiers: newTiers });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Perks</Label>
                            <div className="flex flex-wrap gap-1">
                              {tier.perks.map((perk) => (
                                <Badge
                                  key={perk}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {perk.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {tier.perks.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  No perks
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving && <BagLoader size={16} />}
                  Save Settings
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rewards Catalog</CardTitle>
                  <CardDescription>
                    Create rewards customers can redeem with points
                  </CardDescription>
                </div>
                <Button>
                  <Gift className="size-4 mr-2" />
                  Add Reward
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Award className="size-12 mx-auto mb-4 opacity-50" />
                <p>No rewards created yet</p>
                <p className="text-sm">
                  Create rewards like discounts, free shipping, or free products
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
