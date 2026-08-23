'use client';

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { SocialAdsAccountControls } from '@/components/analytics/social-ads-account-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import { useMerchant } from '@/hooks/use-merchant-client';
import type { AdsSyncWindow } from '@/lib/analytics/default-ads-sync-window';
import { cn } from '@/lib/utils';

export type SocialAdsProvider = 'meta_ads' | 'tiktok_ads' | 'snapchat_ads';
export type SocialAdsConnectionStatus = 'connected' | 'disconnected' | 'error';

interface SpendByCurrency {
  currencyCode: string;
  spendAmountDecimal: string;
}

export interface SocialAdsProviderReporting {
  accountName: string | null;
  accountTimezone: string | null;
  clicksLabel: string;
  connectionStatus: SocialAdsConnectionStatus;
  conversionsLabel: string;
  dataStatus: 'ready' | 'error';
  displayName: string;
  error: string | null;
  freshness: 'fresh' | 'stale' | 'never_synced' | 'not_applicable';
  isStale: boolean;
  lastSyncedAt: string | null;
  metrics: {
    clicks: string;
    conversions: string;
    endDate: string | null;
    impressions: string;
    reach: string | null;
    spendByCurrency: SpendByCurrency[];
    startDate: string | null;
  } | null;
  needsAccountSelection: boolean;
  provider: SocialAdsProvider;
}

export interface SocialAdsReportingData {
  attributionNotice: string;
  mixedCurrencies: boolean;
  providers: SocialAdsProviderReporting[];
  spendByCurrency: SpendByCurrency[];
}

interface SocialAdsReportingCardProps {
  className?: string;
  onSynced?: () => void;
  reporting?: SocialAdsReportingData | null;
  syncWindow?: AdsSyncWindow;
}

const PATH_SEGMENT: Record<SocialAdsProvider, string> = {
  meta_ads: 'meta',
  snapchat_ads: 'snapchat',
  tiktok_ads: 'tiktok',
};

function formatCount(value: string) {
  const number = Number(value);
  return Number.isSafeInteger(number)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
        number
      )
    : value;
}

function formatSpend({ currencyCode, spendAmountDecimal }: SpendByCurrency) {
  const value = Number(spendAmountDecimal);
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    return `${currencyCode} ${spendAmountDecimal}`;
  }
  try {
    return new Intl.NumberFormat('en-US', {
      currency: currencyCode,
      maximumFractionDigits: 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `${currencyCode} ${spendAmountDecimal}`;
  }
}

function formatSyncTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ProviderPanel({
  merchantId,
  onSynced,
  provider,
  syncWindow,
}: {
  merchantId?: string;
  onSynced?: () => void;
  provider: SocialAdsProviderReporting;
  syncWindow?: AdsSyncWindow;
}) {
  const connectPath = new URL(
    `/api/integrations/ads/${PATH_SEGMENT[provider.provider]}/connect`,
    'https://usebaci.com'
  );
  if (merchantId) connectPath.searchParams.set('merchantId', merchantId);
  const syncedAt = formatSyncTime(provider.lastSyncedAt);

  return (
    <section
      className="space-y-3 rounded-xl border p-3"
      aria-label={`${provider.displayName} reporting`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{provider.displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {[provider.accountName, provider.accountTimezone]
              .filter(Boolean)
              .join(' · ') || 'No reporting account selected'}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-1 text-xs',
            provider.connectionStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : provider.connectionStatus === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {provider.connectionStatus === 'connected'
            ? 'Connected'
            : provider.connectionStatus === 'error'
              ? 'Needs attention'
              : 'Not connected'}
        </span>
      </div>

      {provider.connectionStatus !== 'connected' ? (
        <div className="space-y-2">
          {provider.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{provider.error}</AlertDescription>
            </Alert>
          )}
          <Button asChild size="sm">
            <a href={`${connectPath.pathname}${connectPath.search}`}>
              {provider.connectionStatus === 'error' ? 'Reconnect' : 'Connect'}{' '}
              {provider.displayName}
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      ) : (
        <>
          {provider.dataStatus === 'error' && provider.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{provider.error}</AlertDescription>
            </Alert>
          )}
          {provider.isStale && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Reporting is stale. Sync this account to refresh its metrics.
              </AlertDescription>
            </Alert>
          )}
          {provider.metrics ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {provider.metrics.spendByCurrency.map((spend) => (
                <Metric
                  key={spend.currencyCode}
                  label={`Spend (${spend.currencyCode})`}
                  value={formatSpend(spend)}
                />
              ))}
              <Metric
                label="Impressions"
                value={formatCount(provider.metrics.impressions)}
              />
              <Metric
                label={provider.clicksLabel}
                value={formatCount(provider.metrics.clicks)}
              />
              {provider.metrics.reach !== null && (
                <Metric
                  label="Reach"
                  value={formatCount(provider.metrics.reach)}
                />
              )}
              <Metric
                label={provider.conversionsLabel}
                value={formatCount(provider.metrics.conversions)}
              />
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>
                {provider.needsAccountSelection
                  ? 'Choose a reporting account to import daily metrics.'
                  : 'This account is connected. Metrics appear after the first sync.'}
              </p>
            </div>
          )}
          <SocialAdsAccountControls
            displayName={provider.displayName}
            merchantId={merchantId}
            needsAccountSelection={provider.needsAccountSelection}
            onSynced={onSynced}
            provider={provider.provider}
            syncWindow={syncWindow}
          />
        </>
      )}

      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Source: {provider.displayName} reporting</span>
        {syncedAt && <span>Last synced {syncedAt}</span>}
      </div>
    </section>
  );
}

export function SocialAdsReportingCard({
  className,
  onSynced,
  reporting,
  syncWindow,
}: SocialAdsReportingCardProps) {
  const { merchant } = useMerchant();
  return (
    <BentoCard
      className={cn('h-full', className)}
      description="Read-only provider spend and campaign delivery metrics"
      icon={BarChart3}
      title="Social ads reporting"
    >
      {!reporting || reporting.providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Social ads reporting is temporarily unavailable.
        </p>
      ) : (
        <div className="space-y-4">
          {reporting.mixedCurrencies && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Spend uses multiple currencies. Totals are shown separately and
                are never added together.
              </AlertDescription>
            </Alert>
          )}
          {reporting.spendByCurrency.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              {reporting.spendByCurrency.map((spend) => (
                <span
                  className="rounded-full bg-muted px-3 py-1"
                  key={spend.currencyCode}
                >
                  Total {formatSpend(spend)}
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-3 xl:grid-cols-3">
            {reporting.providers.map((provider) => (
              <ProviderPanel
                key={provider.provider}
                merchantId={merchant?.id}
                onSynced={onSynced}
                provider={provider}
                syncWindow={syncWindow}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {reporting.attributionNotice} Baci does not calculate social-ad ROAS
            from these provider conversion signals.
          </p>
        </div>
      )}
    </BentoCard>
  );
}
