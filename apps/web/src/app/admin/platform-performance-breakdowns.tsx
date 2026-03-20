'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  BusinessTypeBreakdown,
  MerchantActivationStage,
  SalesChannelBreakdown,
  SignupSourceBreakdown,
} from '@/types/analytics';

interface PlatformPerformanceBreakdownsProps {
  businessTypes: BusinessTypeBreakdown[];
  loading: boolean;
  merchantActivation: MerchantActivationStage[];
  periodLabel: string;
  salesByChannel: SalesChannelBreakdown[];
  signupSources: SignupSourceBreakdown[];
}

const CHANNEL_SKELETON_IDS = [
  'channel-skeleton-a',
  'channel-skeleton-b',
  'channel-skeleton-c',
  'channel-skeleton-d',
];

const ACTIVATION_SKELETON_IDS = [
  'activation-skeleton-a',
  'activation-skeleton-b',
  'activation-skeleton-c',
  'activation-skeleton-d',
  'activation-skeleton-e',
  'activation-skeleton-f',
  'activation-skeleton-g',
  'activation-skeleton-h',
];

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  electronics: 'Electronics & Gadgets',
  fashion: 'Fashion & Apparel',
  'food-beverage': 'Food & Beverage',
  'hair-extensions': 'Hair Extensions',
  'health-beauty': 'Health & Beauty',
  'home-goods': 'Home Goods & Decor',
  pharmaceuticals: 'Pharmaceuticals',
  unspecified: 'Unspecified',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    mobile_app: 'Mobile App',
    online_store: 'Online Store',
    physical: 'Physical Store',
    storefront: 'Storefront',
    unknown: 'Unknown',
    whatsapp: 'WhatsApp',
  };

  return (
    labels[source] ??
    source
      .split(/[_-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  );
}

function formatBusinessTypeLabel(businessType: string): string {
  const normalized = businessType.trim().toLowerCase();
  const configuredLabel = BUSINESS_TYPE_LABELS[normalized];
  if (configuredLabel) {
    return configuredLabel;
  }

  return normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

const SIGNUP_SOURCE_LABELS: Record<string, string> = {
  android: 'Android App',
  ios: 'iOS App',
  web: 'Web Browser',
};

const SIGNUP_SOURCE_COLORS: Record<string, string> = {
  android: 'bg-emerald-500',
  ios: 'bg-blue-500',
  web: 'bg-indigo-500',
};

function getSignupSourceLabel(source: string): string {
  return SIGNUP_SOURCE_LABELS[source] ?? 'Other';
}

function getSignupSourceColor(source: string): string {
  return SIGNUP_SOURCE_COLORS[source] ?? 'bg-slate-400';
}

export function PlatformPerformanceBreakdowns({
  businessTypes,
  loading,
  merchantActivation,
  periodLabel,
  salesByChannel,
  signupSources,
}: PlatformPerformanceBreakdownsProps) {
  const totalSignups = signupSources.reduce((sum, s) => sum + s.merchants, 0);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Order Sources</CardTitle>
          <CardDescription>
            Paid GMV and order mix for the {periodLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {CHANNEL_SKELETON_IDS.map((skeletonId) => (
                <div key={skeletonId} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
          ) : salesByChannel.length > 0 ? (
            <div className="space-y-5">
              {salesByChannel.map((channel) => (
                <div key={channel.channel} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {formatSourceLabel(channel.channel)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {channel.orders} orders,{' '}
                        {formatPercent(channel.shareOfOrders)} of order volume
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(channel.gmv)}
                    </p>
                  </div>
                  <Progress
                    className="h-2"
                    value={Number(channel.shareOfGmv.toFixed(2))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(channel.shareOfGmv)} of paid GMV
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
              No order source data for this window.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Merchant Readiness</CardTitle>
          <CardDescription>
            Setup, launch, and revenue milestones across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-4">
              {ACTIVATION_SKELETON_IDS.map((skeletonId) => (
                <div key={skeletonId} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-52" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {merchantActivation.length > 0 ? (
                <div className="space-y-4">
                  {merchantActivation.map((stage) => (
                    <div key={stage.key} className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{stage.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {stage.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{stage.merchants}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent(stage.completionRate)}
                          </p>
                        </div>
                      </div>
                      <Progress
                        className="h-2"
                        value={Number(stage.completionRate.toFixed(2))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                  No activation data yet.
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="font-medium">Business Types</p>
                  <p className="text-sm text-muted-foreground">
                    Merchant category mix from onboarding metadata
                  </p>
                </div>
                {businessTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {businessTypes.map((businessType) => (
                      <div
                        key={businessType.businessType}
                        className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium"
                      >
                        {formatBusinessTypeLabel(businessType.businessType)} ·{' '}
                        {businessType.merchants}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No business type data yet.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {/* Signup Sources */}
      <Card className="glass xl:col-span-2">
        <CardHeader>
          <CardTitle>Signups by Platform</CardTitle>
          <CardDescription>
            Where merchants are signing up from across Web, iOS, and Android
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-6">
              {CHANNEL_SKELETON_IDS.slice(0, 3).map((skeletonId) => (
                <div key={skeletonId} className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : totalSignups > 0 ? (
            <div className="space-y-6">
              {/* Stacked bar */}
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {signupSources
                  .filter((s) => s.merchants > 0)
                  .map((s) => (
                    <div
                      key={s.source}
                      className={`${getSignupSourceColor(s.source)} transition-all`}
                      style={{
                        width: `${s.shareOfMerchants}%`,
                      }}
                      title={`${getSignupSourceLabel(s.source)}: ${s.merchants}`}
                    />
                  ))}
              </div>

              {/* Breakdown cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                {signupSources.map((s) => (
                  <div
                    key={s.source}
                    className="flex items-center gap-3 rounded-lg border p-4"
                  >
                    <div
                      className={`h-3 w-3 rounded-full ${getSignupSourceColor(s.source)}`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {getSignupSourceLabel(s.source)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPercent(s.shareOfMerchants)} of signups
                      </p>
                    </div>
                    <p className="text-xl font-bold">{s.merchants}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
              No signup source data yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
