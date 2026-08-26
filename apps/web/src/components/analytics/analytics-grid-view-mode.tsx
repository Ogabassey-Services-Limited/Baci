import { AlertTriangle, Settings2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { renderAdsAnalyticsWidgets } from './ads-analytics-widgets';
import { AIInsightsPanel } from './ai-insights-panel';
import { AnalyticsBusinessWidgets } from './analytics-business-widgets';
import { AnalyticsDetailWidgetGroup } from './analytics-detail-widget-group';
import type {
  AnalyticsGridProps,
  AnalyticsSummary,
  CurrencyFormatter,
  PercentFormatter,
  WidgetVisibility,
} from './analytics-grid-types';
import { AnalyticsInventoryWidgets } from './analytics-inventory-widgets';
import { AnalyticsSalesWidgets } from './analytics-sales-widgets';
import { AnalyticsSegmentWidgets } from './analytics-segment-widgets';
import { AnalyticsSummaryWidgets } from './analytics-summary-widgets';

interface AnalyticsGridViewModeProps
  extends Pick<
    AnalyticsGridProps,
    | 'activeCategory'
    | 'canManageAdsIntegrations'
    | 'canCustomizeLayout'
    | 'categoryError'
    | 'data'
    | 'merchant'
    | 'onAdsReportingSynced'
    | 'syncWindow'
  > {
  formatCurrency: CurrencyFormatter;
  formatPercent: PercentFormatter;
  isWidgetVisible: WidgetVisibility;
  onEdit: () => void;
  summary: AnalyticsSummary;
}

export function AnalyticsGridViewMode({
  activeCategory,
  canManageAdsIntegrations,
  canCustomizeLayout,
  categoryError,
  data,
  formatCurrency,
  formatPercent,
  isWidgetVisible,
  merchant,
  onAdsReportingSynced,
  onEdit,
  summary,
  syncWindow,
}: AnalyticsGridViewModeProps) {
  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden">
      {categoryError && (
        <Alert className="mb-4" variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{categoryError}</AlertDescription>
        </Alert>
      )}
      <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="w-full min-w-0 flex-1">
          <AIInsightsPanel
            activeCategory={activeCategory}
            merchantId={merchant?.id}
          />
        </div>
        {canCustomizeLayout && (
          <Button
            aria-label="Customize Dashboard Layout"
            className="shrink-0 gap-2"
            onClick={onEdit}
            size="sm"
            variant="outline"
          >
            <Settings2 className="size-4" />
            Customize Dashboard
          </Button>
        )}
      </div>
      <AnalyticsSummaryWidgets
        formatCurrency={formatCurrency}
        formatPercent={formatPercent}
        isWidgetVisible={isWidgetVisible}
        summary={summary}
      />
      <AnalyticsBusinessWidgets
        data={data}
        formatCurrency={formatCurrency}
        isWidgetVisible={(id) =>
          id === 'analytics-highlights' && isWidgetVisible(id)
        }
        summary={summary}
      />
      <AnalyticsSalesWidgets
        data={data}
        formatCurrency={formatCurrency}
        isWidgetVisible={isWidgetVisible}
        viewSection="charts"
      />
      <AnalyticsBusinessWidgets
        data={data}
        formatCurrency={formatCurrency}
        isWidgetVisible={(id) =>
          id === 'financial-summary' && isWidgetVisible(id)
        }
        summary={summary}
      />
      <AnalyticsDetailWidgetGroup
        data={data}
        formatCurrency={formatCurrency}
        isWidgetVisible={isWidgetVisible}
        viewMode
      />
      <AnalyticsSalesWidgets
        data={data}
        formatCurrency={formatCurrency}
        isWidgetVisible={isWidgetVisible}
        viewSection="lists"
      />
      {activeCategory === 'inventory' && (
        <AnalyticsInventoryWidgets
          data={data}
          isWidgetVisible={isWidgetVisible}
        />
      )}
      {activeCategory === 'segments' && (
        <AnalyticsSegmentWidgets
          data={data}
          formatCurrency={formatCurrency}
          isWidgetVisible={isWidgetVisible}
        />
      )}
      {activeCategory === 'ads' &&
        renderAdsAnalyticsWidgets({
          adAnalytics: data.adAnalytics,
          canManageIntegrations: canManageAdsIntegrations,
          formatCurrency,
          isWidgetVisible,
          merchantId: merchant?.id,
          onAdsReportingSynced,
          syncWindow,
        })}
    </div>
  );
}
