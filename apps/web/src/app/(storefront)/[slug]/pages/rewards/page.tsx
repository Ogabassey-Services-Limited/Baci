'use client';

import {
  AlertCircle,
  Award,
  Gift,
  History,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoyaltyEnrollmentForm } from '@/components/storefront/loyalty/loyalty-enrollment-form';
import { LoyaltyStatusCard } from '@/components/storefront/loyalty/loyalty-status-card';
import { RewardsCatalog } from '@/components/storefront/loyalty/rewards-catalog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useLoyalty } from '@/hooks/use-loyalty';

export default function RewardsPage() {
  const params = useParams();
  const slug = params.slug as string;

  // In a real app, you'd get these from authentication context
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Get customer from auth context (more secure than localStorage)
  const { customer } = useCustomerAuth();

  // Fetch merchant info on mount and when slug changes
  useEffect(() => {
    // Use customer from auth context instead of localStorage (prevents XSS exposure)
    if (customer?.id) {
      setCustomerId(customer.id);
    }

    const fetchMerchant = async () => {
      setIsRetrying(true);
      setError(null); // Clear error at start of retry for better UX
      try {
        const response = await fetch(`/api/storefront/merchant?slug=${slug}`);
        if (response.ok) {
          const data = await response.json();
          setMerchantId(data.id);
          setMerchantName(data.business_name || '');
        } else {
          setError('Failed to load merchant information');
        }
      } catch (err) {
        console.error('Failed to fetch merchant:', err);
        setError('Failed to load merchant information');
      } finally {
        setIsRetrying(false);
      }
    };

    fetchMerchant();
  }, [customer?.id, slug]);

  // Retry handler for error state
  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/storefront/merchant?slug=${slug}`);
      if (response.ok) {
        const data = await response.json();
        setMerchantId(data.id);
        setMerchantName(data.business_name || '');
      } else {
        setError('Failed to load merchant information');
      }
    } catch (err) {
      console.error('Failed to fetch merchant:', err);
      setError('Failed to load merchant information');
    } finally {
      setIsRetrying(false);
    }
  };

  const { enrolled, loading, recentTransactions, getTierInfo, tier } =
    useLoyalty(merchantId || undefined, customerId || undefined);

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="sr-only">Rewards</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Unable to Load Rewards
              </h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (!merchantId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="sr-only">Rewards</h1>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Not logged in state
  if (!customerId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <Sparkles className="h-8 w-8 text-purple-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Rewards Program</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sign in to your account to view your rewards, earn points, and
            redeem exclusive offers
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to access rewards</CardTitle>
            <CardDescription>
              Already have an account? Sign in to view your points and rewards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/${slug}/account/login?redirect=/${slug}/pages/rewards`}
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Sign In to Continue
            </Link>
          </CardContent>
        </Card>

        {/* Show benefits preview */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Member Benefits</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Sparkles,
                title: 'Earn Points',
                description: 'Get points on every purchase',
              },
              {
                icon: Gift,
                title: 'Redeem Rewards',
                description: 'Exchange points for discounts',
              },
              {
                icon: Trophy,
                title: 'Unlock Tiers',
                description: 'Rise through member levels',
              },
              {
                icon: Award,
                title: 'Exclusive Access',
                description: 'Early access to sales',
              },
            ].map((benefit) => (
              <Card key={benefit.title}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-purple-100 rounded-full mb-3">
                      <benefit.icon className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="font-medium mb-1">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tierInfo = tier ? getTierInfo(tier) : null;
  const displayTier = tier
    ? tier.charAt(0).toUpperCase() + tier.slice(1)
    : 'Member';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Rewards</h1>
        <p className="text-muted-foreground">
          Earn points, unlock rewards, and enjoy exclusive member benefits
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !enrolled ? (
        <LoyaltyEnrollmentForm
          merchantId={merchantId}
          customerId={customerId}
          merchantName={merchantName}
        />
      ) : (
        <div className="space-y-6">
          {/* Status Card */}
          <LoyaltyStatusCard merchantId={merchantId} customerId={customerId} />

          {/* Tier Benefits */}
          {tierInfo && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    {displayTier} Member
                  </CardTitle>
                  <Badge
                    className={`${tierInfo.colors.bg} ${tierInfo.colors.text}`}
                  >
                    Current Tier
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Your tier benefits:
                </p>
                <ul className="space-y-2">
                  {tierInfo.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Tabs for Rewards and History */}
          <Tabs defaultValue="rewards">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rewards" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Rewards
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rewards" className="mt-4">
              <RewardsCatalog merchantId={merchantId} customerId={customerId} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Points History</CardTitle>
                  <CardDescription>Your recent points activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        No transactions yet
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Make a purchase to start earning points
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between py-3 border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full ${
                                transaction.points > 0
                                  ? 'bg-green-100'
                                  : 'bg-red-100'
                              }`}
                            >
                              {transaction.points > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {transaction.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  transaction.created_at
                                ).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`font-semibold ${
                              transaction.points > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            {transaction.points > 0 ? '+' : ''}
                            {transaction.points.toLocaleString()} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
