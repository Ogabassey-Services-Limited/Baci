'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Gift,
  Crown,
  Star,
  Users,
  TrendingUp,
  Settings,
  Search,
  Loader2,
  Award,
  Coins
} from 'lucide-react';
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
  const [customers, setCustomers] = useState<CustomerLoyalty[]>([]);
  const [tierDistribution, setTierDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchCustomers();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/loyalty/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch loyalty settings:', error);
    }
  }

  async function fetchCustomers(tier?: string | null) {
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
  }

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

  const totalCustomers = Object.values(tierDistribution).reduce((a, b) => a + b, 0);
  const totalPoints = customers.reduce((sum, c) => sum + c.points_balance, 0);

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      c.customers?.name?.toLowerCase().includes(search) ||
      c.customers?.email?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            onCheckedChange={(checked) => setSettings(s => s ? { ...s, enabled: checked } : null)}
          />
          <span className="text-sm font-medium">
            {settings?.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Outstanding</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Worth {formatCurrency(totalPoints * (settings?.points_to_currency_ratio || 0.01))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gold+ Members</CardTitle>
            <Crown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(tierDistribution['Gold'] || 0) + (tierDistribution['Platinum'] || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Points/Member</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCustomers > 0 ? Math.round(totalPoints / totalCustomers).toLocaleString() : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="h-4 w-4 mr-2" />
            Rewards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {/* Tier Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tier Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedTier === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedTier(null);
                    fetchCustomers(null);
                  }}
                >
                  All ({totalCustomers})
                </Button>
                {settings?.tiers.map(tier => (
                  <Button
                    key={tier.name}
                    variant={selectedTier === tier.name ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedTier(tier.name);
                      fetchCustomers(tier.name);
                    }}
                    className={selectedTier === tier.name ? tierColors[tier.name] : ''}
                  >
                    {tier.name} ({tierDistribution[tier.name] || 0})
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Members List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Members</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Points Balance</TableHead>
                    <TableHead className="text-right">Lifetime Points</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.customers?.name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.customers?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={tierColors[customer.current_tier] || 'bg-gray-500'}>
                          {customer.current_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {customer.points_balance.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.lifetime_points.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.referral_count}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No members found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {settings && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Program Settings</CardTitle>
                  <CardDescription>Configure how customers earn and redeem points</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Program Name</Label>
                      <Input
                        value={settings.program_name}
                        onChange={(e) => setSettings({ ...settings, program_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Points Expiry (days)</Label>
                      <Input
                        type="number"
                        value={settings.points_expiry_days}
                        onChange={(e) => setSettings({ ...settings, points_expiry_days: parseInt(e.target.value) || 365 })}
                      />
                      <p className="text-xs text-muted-foreground">Set to 0 for no expiry</p>
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
                      <Label>Points per {formatCurrency(settings.points_currency_unit)}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.points_per_currency}
                        onChange={(e) => setSettings({ ...settings, points_per_currency: parseFloat(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency Unit ({formatCurrency(1)})</Label>
                      <Input
                        type="number"
                        value={settings.points_currency_unit}
                        onChange={(e) => setSettings({ ...settings, points_currency_unit: parseFloat(e.target.value) || 100 })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Signup Bonus</Label>
                      <Input
                        type="number"
                        value={settings.signup_bonus_points}
                        onChange={(e) => setSettings({ ...settings, signup_bonus_points: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Birthday Bonus</Label>
                      <Input
                        type="number"
                        value={settings.birthday_bonus_points}
                        onChange={(e) => setSettings({ ...settings, birthday_bonus_points: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Review Bonus</Label>
                      <Input
                        type="number"
                        value={settings.review_bonus_points}
                        onChange={(e) => setSettings({ ...settings, review_bonus_points: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Referral Bonus</Label>
                      <Input
                        type="number"
                        value={settings.referral_bonus_points}
                        onChange={(e) => setSettings({ ...settings, referral_bonus_points: parseInt(e.target.value) || 0 })}
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
                      <Label>Points to Currency Ratio</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={settings.points_to_currency_ratio}
                        onChange={(e) => setSettings({ ...settings, points_to_currency_ratio: parseFloat(e.target.value) || 0.01 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        1 point = {formatCurrency(settings.points_to_currency_ratio)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Redemption Points</Label>
                      <Input
                        type="number"
                        value={settings.minimum_redemption_points}
                        onChange={(e) => setSettings({ ...settings, minimum_redemption_points: parseInt(e.target.value) || 500 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max % of Order with Points</Label>
                      <Input
                        type="number"
                        max={100}
                        value={settings.maximum_redemption_percentage}
                        onChange={(e) => setSettings({ ...settings, maximum_redemption_percentage: parseFloat(e.target.value) || 50 })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Membership Tiers</CardTitle>
                  <CardDescription>Define tier levels and benefits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {settings.tiers.map((tier, index) => (
                      <div key={tier.name} className="flex items-center gap-4 p-4 border rounded-lg">
                        <Badge className={tierColors[tier.name] || 'bg-gray-500'}>
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
                                newTiers[index].minPoints = parseInt(e.target.value) || 0;
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
                                newTiers[index].multiplier = parseFloat(e.target.value) || 1;
                                setSettings({ ...settings, tiers: newTiers });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Perks</Label>
                            <div className="flex flex-wrap gap-1">
                              {tier.perks.map(perk => (
                                <Badge key={perk} variant="outline" className="text-xs">
                                  {perk.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {tier.perks.length === 0 && (
                                <span className="text-xs text-muted-foreground">No perks</span>
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
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
                  <CardDescription>Create rewards customers can redeem with points</CardDescription>
                </div>
                <Button>
                  <Gift className="h-4 w-4 mr-2" />
                  Add Reward
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rewards created yet</p>
                <p className="text-sm">Create rewards like discounts, free shipping, or free products</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
