import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalyticsInventoryWidgets } from './analytics-inventory-widgets';

describe('AnalyticsInventoryWidgets', () => {
  it('uses the resolved inventory count supplied by analytics', () => {
    render(
      <AnalyticsInventoryWidgets
        data={{ resolvedInventoryAlertCount: 6 }}
        isWidgetVisible={(id) => id === 'inventory-summary'}
      />
    );

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('lists out-of-stock no-sales products as low stock', () => {
    render(
      <AnalyticsInventoryWidgets
        data={{
          inventoryForecasts: [
            {
              avg_daily_sales: 0,
              current_stock: 0,
              days_of_stock: 999,
              product_id: 'out-of-stock',
              product_name: 'No-sales product',
              sales_trend: 'stable',
            },
          ],
        }}
        isWidgetVisible={(id) => id === 'low-stock-products'}
      />
    );

    expect(screen.getByText('No-sales product')).toBeInTheDocument();
    expect(screen.getByText('0 left')).toBeInTheDocument();
    expect(
      screen.queryByText('All products well stocked')
    ).not.toBeInTheDocument();
  });
});
