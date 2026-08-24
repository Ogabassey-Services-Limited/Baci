'use client';

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Loader2,
  MousePointerClick,
  TrendingUp,
} from 'lucide-react';
import { GoogleAdsAccountPicker } from '@/components/analytics/google-ads-account-picker';
import { GoogleAdsConnectButton } from '@/components/analytics/google-ads-connect-button';
import { GoogleAdsMetric } from '@/components/analytics/google-ads-metric';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BentoCard } from '@/components/ui/bento-card';
import { useMerchant } from '@/hooks/use-merchant-client';
import type { AdsSyncWindow } from '@/lib/analytics/default-ads-sync-window';
import { cn } from '@/lib/utils';
import {
  formatGoogleAdsMetric,
  formatGoogleAdsReportingWindow,
} from './google-ads-reporting-format';

export { GOOGLE_ADS_CONNECT_PATH } from './google-ads-connect-path';

/**
 * Server-reported Google Ads metrics for one selected reporting window.
 *
 * Values are optional on purpose. A missing value means that Google has not
 * supplied that metric yet; the dashboard must not turn it into a misleading
 * zero. CTR is expressed as a percentage (for example, 2.4 means 2.4%).
 */
export interface GoogleAdsReportingMetrics {
  clicks?: number;
  conversions?: number;
  cpc?: number;
  ctr?: number;
  endDate?: string;
  impressions?: number;
  spend?: number;
  startDate?: string;
}

export type GoogleAdsConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'syncing';

export interface GoogleAdsReportingData {
  connectionStatus?: GoogleAdsConnectionStatus;
  currency?: string;
  dataStatus?: 'error' | 'ready';
  error?: string;
  isStale?: boolean;
  lastSyncedAt?: string;
  metrics?: GoogleAdsReportingMetrics;
  needsAccountSelection?: boolean;
  /** A non-sensitive account label supplied by the server. */
  accountName?: string;
}

interface GoogleAdsReportingCardProps {
  className?: string;
  loading?: boolean;
  onSynced?: () => void;
  reporting?: GoogleAdsReportingData | null;
  syncWindow?: AdsSyncWindow;
}

export function GoogleAdsReportingCard({
  className,
  loading = false,
  onSynced,
  reporting,
  syncWindow,
}: GoogleAdsReportingCardProps) {
  const { merchant } = useMerchant();
  const status =
    reporting?.connectionStatus ??
    (reporting?.metrics ? 'connected' : 'disconnected');
  const currency = reporting?.currency ?? 'USD';
  const metrics = reporting?.metrics;
  const periodLabel = metrics ? formatGoogleAdsReportingWindow(metrics) : null;

  return (
    <BentoCard
      className={cn('h-full', className)}
      description="Provider-reported spend and campaign performance"
      icon={BarChart3}
      title="Google Ads reporting"
    >
      {loading || status === 'syncing' ? (
        <div
          className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" />
          Loading Google Ads reporting…
        </div>
      ) : status === 'error' ? (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {reporting?.error ??
                'Google Ads reporting could not be loaded. Your store analytics are still available.'}
            </AlertDescription>
          </Alert>
          {reporting?.dataStatus === 'error' ? (
            <GoogleAdsAccountPicker
              merchantId={merchant?.id}
              onSynced={onSynced}
              syncWindow={syncWindow}
            />
          ) : (
            <GoogleAdsConnectButton
              label="Reconnect Google Ads"
              merchantId={merchant?.id}
            />
          )}
        </div>
      ) : status !== 'connected' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect a Google Ads reporting account to bring ad spend,
            impressions, clicks, and conversion metrics into this dashboard.
          </p>
          <GoogleAdsConnectButton merchantId={merchant?.id} />
        </div>
      ) : reporting?.needsAccountSelection ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Google Ads is connected. Select a reporting account to start
            importing spend and campaign metrics.
          </p>
          <GoogleAdsAccountPicker
            merchantId={merchant?.id}
            onSynced={onSynced}
            syncWindow={syncWindow}
          />
        </div>
      ) : !metrics ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>
              {reporting?.accountName
                ? `${reporting.accountName} is connected.`
                : 'Google Ads is connected.'}{' '}
              Metrics will appear after the first reporting sync. Select another
              accessible account or retry the sync if needed.
            </p>
          </div>
          <GoogleAdsAccountPicker
            merchantId={merchant?.id}
            onSynced={onSynced}
            syncWindow={syncWindow}
          />
          <GoogleAdsConnectButton
            label="Reconnect Google Ads"
            merchantId={merchant?.id}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {reporting.accountName
                ? `Account: ${reporting.accountName}`
                : 'Connected account'}
            </span>
            {periodLabel && <span>Reporting window: {periodLabel}</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {metrics.spend !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatGoogleAdsMetric(
                  metrics.spend,
                  'currency',
                  currency
                )}
                icon={<TrendingUp className="size-3.5" />}
                label="Spend"
              />
            )}
            {metrics.impressions !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatGoogleAdsMetric(
                  metrics.impressions,
                  'number',
                  currency
                )}
                icon={<BarChart3 className="size-3.5" />}
                label="Impressions"
              />
            )}
            {metrics.clicks !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatGoogleAdsMetric(
                  metrics.clicks,
                  'number',
                  currency
                )}
                icon={<MousePointerClick className="size-3.5" />}
                label="Clicks"
              />
            )}
            {metrics.ctr !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatGoogleAdsMetric(
                  metrics.ctr,
                  'percent',
                  currency
                )}
                icon={<PercentIcon />}
                label="CTR"
              />
            )}
            {metrics.cpc !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatGoogleAdsMetric(
                  metrics.cpc,
                  'currency',
                  currency
                )}
                icon={<MousePointerClick className="size-3.5" />}
                label="CPC"
              />
            )}
            {metrics.conversions !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatGoogleAdsMetric(
                  metrics.conversions,
                  'number',
                  currency
                )}
                icon={<CheckCircle2 className="size-3.5" />}
                label="Google-attributed conversions"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Source: Google Ads reporting</span>
            {reporting.lastSyncedAt && (
              <span>
                Last synced {new Date(reporting.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>
          {reporting?.isStale && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Reporting data may be stale. Sync the selected account to
                refresh provider-reported metrics.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Sync the selected account or choose another accessible Google Ads
              account. Provider-attributed conversions remain separate from Baci
              order attribution and revenue.
            </p>
            <GoogleAdsAccountPicker
              merchantId={merchant?.id}
              onSynced={onSynced}
              syncWindow={syncWindow}
            />
          </div>
        </div>
      )}
    </BentoCard>
  );
}

function PercentIcon() {
  return (
    <span aria-hidden="true" className="text-[11px] font-semibold">
      %
    </span>
  );
}
