import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsGridViewMode } from './analytics-grid-view-mode';
import { EMPTY_ANALYTICS_SUMMARY } from './analytics-summary-widgets';

vi.mock('./ai-insights-panel', () => ({
  AIInsightsPanel: () => <div>Insights</div>,
}));
vi.mock('./analytics-summary-widgets', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  AnalyticsSummaryWidgets: () => <div>Summary</div>,
}));
vi.mock('./analytics-business-widgets', () => ({
  AnalyticsBusinessWidgets: () => <div>Business</div>,
}));
vi.mock('./analytics-sales-widgets', () => ({
  AnalyticsSalesWidgets: () => <div>Sales</div>,
}));
vi.mock('./analytics-detail-widget-group', () => ({
  AnalyticsDetailWidgetGroup: () => <div>Details</div>,
}));
vi.mock('./ads-analytics-widgets', () => ({
  renderAdsAnalyticsWidgets: () => null,
}));

const baseProps = {
  activeCategory: 'overview' as const,
  categoryError: null,
  data: {},
  formatCurrency: String,
  formatPercent: String,
  isWidgetVisible: () => false,
  merchant: null,
  onEdit: vi.fn(),
  summary: EMPTY_ANALYTICS_SUMMARY,
};

describe('AnalyticsGridViewMode', () => {
  it('hides layout customization without settings edit permission', () => {
    render(<AnalyticsGridViewMode {...baseProps} canCustomizeLayout={false} />);

    expect(
      screen.queryByRole('button', { name: 'Customize Dashboard Layout' })
    ).not.toBeInTheDocument();
  });

  it('allows an authorized merchant to enter edit mode', () => {
    const onEdit = vi.fn();
    render(
      <AnalyticsGridViewMode
        {...baseProps}
        canCustomizeLayout
        onEdit={onEdit}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Customize Dashboard Layout' })
    );
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
