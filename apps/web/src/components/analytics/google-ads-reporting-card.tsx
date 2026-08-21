'use client';

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Loader2,
  MousePointerClick,
  RefreshCcw,
  TrendingUp,
} from 'lucide-react';
import { GoogleAdsAccountPicker } from '@/components/analytics/google-ads-account-picker';
import { GoogleAdsConnectButton } from '@/components/analytics/google-ads-connect-button';
import { GoogleAdsMetric } from '@/components/analytics/google-ads-metric';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BentoCard } from '@/components/ui/bento-card';
import { cn } from '@/lib/utils';

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
  roas?: number;
  /** Required before ROAS is shown as an attributed Baci metric. */
  roasBasis?: 'baci-attributed-revenue';
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
  error?: string;
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
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      currency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatMetric(
  value: number,
  kind: 'currency' | 'number' | 'percent' | 'ratio',
  currency: string
): string {
  if (kind === 'currency') {
    return formatCurrency(value, currency);
  }

  if (kind === 'percent') {
    return `${value.toFixed(2)}%`;
  }

  if (kind === 'ratio') {
    return `${value.toFixed(2)}x`;
  }

  return formatNumber(value);
}

function formatWindow(metrics: GoogleAdsReportingMetrics): string | null {
  if (!metrics.startDate || !metrics.endDate) return null;

  const start = new Date(metrics.startDate);
  const end = new Date(metrics.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return `${start.toLocaleDateString('en-US', { dateStyle: 'medium' })} – ${end.toLocaleDateString('en-US', { dateStyle: 'medium' })}`;
}

export function GoogleAdsReportingCard({
  className,
  loading = false,
  onSynced,
  reporting,
}: GoogleAdsReportingCardProps) {
  const status =
    reporting?.connectionStatus ??
    (reporting?.metrics ? 'connected' : 'disconnected');
  const currency = reporting?.currency ?? 'USD';
  const metrics = reporting?.metrics;
  const periodLabel = metrics ? formatWindow(metrics) : null;
  const canShowRoas =
    metrics?.roas !== undefined &&
    metrics.spend !== undefined &&
    metrics.roasBasis === 'baci-attributed-revenue' &&
    Boolean(metrics.startDate && metrics.endDate && reporting?.currency);

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
          <GoogleAdsConnectButton label="Reconnect Google Ads" />
        </div>
      ) : status !== 'connected' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect a Google Ads reporting account to bring ad spend,
            impressions, clicks, and conversion metrics into this dashboard.
          </p>
          <GoogleAdsConnectButton />
        </div>
      ) : reporting?.needsAccountSelection ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Google Ads is connected. Select a reporting account to start
            importing spend and campaign metrics.
          </p>
          <GoogleAdsAccountPicker onSynced={onSynced} />
        </div>
      ) : !metrics ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>
              {reporting?.accountName
                ? `${reporting.accountName} is connected.`
                : 'Google Ads is connected.'}{' '}
              Metrics will appear after the first reporting sync.
            </p>
          </div>
          <GoogleAdsConnectButton label="Reconnect Google Ads" />
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
                formattedValue={formatMetric(
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
                formattedValue={formatMetric(
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
                formattedValue={formatMetric(
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
                formattedValue={formatMetric(metrics.ctr, 'percent', currency)}
                icon={<PercentIcon />}
                label="CTR"
              />
            )}
            {metrics.cpc !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatMetric(metrics.cpc, 'currency', currency)}
                icon={<MousePointerClick className="size-3.5" />}
                label="CPC"
              />
            )}
            {metrics.conversions !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatMetric(
                  metrics.conversions,
                  'number',
                  currency
                )}
                icon={<CheckCircle2 className="size-3.5" />}
                label="Conversions"
              />
            )}
            {canShowRoas && metrics.roas !== undefined && (
              <GoogleAdsMetric
                formattedValue={formatMetric(metrics.roas, 'ratio', currency)}
                icon={<RefreshCcw className="size-3.5" />}
                label="ROAS"
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
          {canShowRoas && (
            <p className="text-xs text-muted-foreground">
              ROAS uses Baci-attributed revenue and Google Ads spend for the
              same reporting window and currency.
            </p>
          )}
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
