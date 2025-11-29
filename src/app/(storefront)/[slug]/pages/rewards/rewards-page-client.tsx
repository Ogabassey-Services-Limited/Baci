'use client';

import { useState } from 'react';
import { Gift, Star, ArrowRight, History, Award } from 'lucide-react';
import { useLoyalty, LoyaltyTier, PointsTransaction } from '@/hooks/use-loyalty';
import {
  LoyaltyStatusCard,
  RewardsCatalog,
  LoyaltyEnrollmentForm,
} from '@/components/storefront/loyalty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  tiers: LoyaltyTier[];
  points_expiry_days: number;
}

interface Merchant {
  id: string;
  business_name: string;
  slug: string;
  logo_url?: string;
  payout_currency?: string;
}

interface RewardsPageClientProps {
  merchant: Merchant;
  settings: LoyaltySettings;
}

export function RewardsPageClient({ merchant, settings }: RewardsPageClientProps) {
  const [customerEmail, setCustomerEmail] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const {
    status,
    isLoading,
    isEnrolled,
    pointsBalance,
    lifetimePoints,
    currentTier,
    availableRewards,
    recentTransactions,
    enroll,
    redeemReward,
    isEnrolling,
    isRedeeming,
    canRedeemReward,
  } = useLoyalty({
    merchantId: merchant.id,
    customerEmail: customerEmail || undefined,
    autoFetch: !!customerEmail,
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingEmail(true);
    // The hook will automatically fetch when customerEmail changes
    setTimeout(() => setIsCheckingEmail(false), 500);
  };

  const handleEnroll = async (
    email: string,
    options?: { name?: string; phone?: string; referralCode?: string }
  ) => {
    const result = await enroll(email, options);
    if (result.success) {
      setCustomerEmail(email);
    }
    return result;
  };

  const handleRedeem = async (rewardId: string) => {
    return redeemReward(rewardId, customerEmail);
  };

  const currency = merchant.payout_currency || 'NGN';
  const currencySymbol = currency === 'NGN' ? '₦' : '$';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{settings.program_name}</h1>
              <p className="text-muted-foreground">
                Earn points on every purchase at {merchant.business_name}
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 bg-background rounded-lg shadow-sm">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Earn Points</p>
                <p className="text-sm text-muted-foreground">
                  {settings.points_per_currency} pts per {currencySymbol}
                  {settings.points_currency_unit}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-background rounded-lg shadow-sm">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Level Up</p>
                <p className="text-sm text-muted-foreground">
                  {settings.tiers?.length || 4} tiers with bonus multipliers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-background rounded-lg shadow-sm">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Redeem Rewards</p>
                <p className="text-sm text-muted-foreground">
                  Discounts, free shipping & more
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Email Check Form (when not logged in) */}
        {!customerEmail && (
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Check Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Check Your Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your email to view your points balance and available rewards.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={isCheckingEmail || !customerEmail}>
                      {isCheckingEmail ? 'Checking...' : 'Check'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Join Program */}
            <LoyaltyEnrollmentForm
              programName={settings.program_name}
              signupBonusPoints={settings.signup_bonus_points}
              referralBonusPoints={settings.referral_bonus_points}
              tiers={settings.tiers}
              onEnroll={handleEnroll}
              isEnrolling={isEnrolling}
            />
          </div>
        )}

        {/* Logged in view */}
        {customerEmail && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="space-y-4">
              {isLoading ? (
                <Card className="animate-pulse">
                  <CardContent className="py-8">
                    <div className="h-6 bg-muted rounded w-1/2 mx-auto mb-4" />
                    <div className="h-10 bg-muted rounded w-3/4 mx-auto" />
                  </CardContent>
                </Card>
              ) : isEnrolled ? (
                <LoyaltyStatusCard
                  isEnrolled={isEnrolled}
                  pointsBalance={pointsBalance}
                  lifetimePoints={lifetimePoints}
                  currentTier={currentTier}
                  currentTierInfo={status?.currentTierInfo}
                  nextTier={status?.nextTier}
                  pointsToNextTier={status?.pointsToNextTier ?? null}
                  referralCode={status?.referralCode ?? null}
                  programName={settings.program_name}
                />
              ) : (
                <LoyaltyEnrollmentForm
                  programName={settings.program_name}
                  signupBonusPoints={settings.signup_bonus_points}
                  referralBonusPoints={settings.referral_bonus_points}
                  tiers={settings.tiers}
                  onEnroll={handleEnroll}
                  isEnrolling={isEnrolling}
                  defaultEmail={customerEmail}
                />
              )}

              {/* Tier Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Tier Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {settings.tiers?.map((tier, index) => {
                    const isCurrentTier = tier.name === currentTier;
                    return (
                      <div
                        key={tier.name}
                        className={cn(
                          'p-3 rounded-lg border',
                          isCurrentTier ? 'border-primary bg-primary/5' : 'border-muted'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{tier.name}</span>
                          {tier.multiplier > 1 && (
                            <Badge variant="secondary">{tier.multiplier}x pts</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {index === 0
                            ? 'Starting tier'
                            : `${tier.minPoints.toLocaleString()}+ lifetime pts`}
                        </p>
                        {tier.perks?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {tier.perks.map((perk) => (
                              <Badge key={perk} variant="outline" className="text-xs">
                                {formatPerk(perk)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="rewards">
                <TabsList className="w-full">
                  <TabsTrigger value="rewards" className="flex-1">
                    <Gift className="h-4 w-4 mr-2" />
                    Rewards
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">
                    <History className="h-4 w-4 mr-2" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="rewards" className="mt-4">
                  <RewardsCatalog
                    rewards={availableRewards}
                    pointsBalance={pointsBalance}
                    onRedeem={handleRedeem}
                    isRedeeming={isRedeeming}
                    canRedeemCheck={canRedeemReward}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  {recentTransactions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium mb-2">No Activity Yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Your points history will appear here after your first purchase.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-4">
                        <div className="space-y-3">
                          {recentTransactions.map((tx: PointsTransaction) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <div>
                                <p className="font-medium text-sm">{tx.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(tx.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={cn(
                                    'font-semibold',
                                    tx.points > 0 ? 'text-green-600' : 'text-red-600'
                                  )}
                                >
                                  {tx.points > 0 ? '+' : ''}
                                  {tx.points.toLocaleString()} pts
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Balance: {tx.balance_after.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Ways to Earn */}
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-6">Ways to Earn Points</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">Every Purchase</h3>
                <p className="text-2xl font-bold text-primary">
                  {settings.points_per_currency} pts
                </p>
                <p className="text-xs text-muted-foreground">
                  per {currencySymbol}
                  {settings.points_currency_unit} spent
                </p>
              </CardContent>
            </Card>

            {settings.signup_bonus_points > 0 && (
              <Card>
                <CardContent className="py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <Gift className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-medium mb-1">Sign Up Bonus</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {settings.signup_bonus_points} pts
                  </p>
                  <p className="text-xs text-muted-foreground">one-time welcome bonus</p>
                </CardContent>
              </Card>
            )}

            {settings.referral_bonus_points > 0 && (
              <Card>
                <CardContent className="py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    <Star className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-medium mb-1">Refer a Friend</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {settings.referral_bonus_points} pts
                  </p>
                  <p className="text-xs text-muted-foreground">for you and your friend</p>
                </CardContent>
              </Card>
            )}

            {settings.review_bonus_points > 0 && (
              <Card>
                <CardContent className="py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                    <Star className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-medium mb-1">Write a Review</h3>
                  <p className="text-2xl font-bold text-purple-600">
                    {settings.review_bonus_points} pts
                  </p>
                  <p className="text-xs text-muted-foreground">per verified review</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatPerk(perk: string): string {
  return perk
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default RewardsPageClient;
