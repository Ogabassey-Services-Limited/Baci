import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalyticsSegmentWidgets } from './analytics-segment-widgets';

describe('AnalyticsSegmentWidgets', () => {
  it('labels and formats champion segment revenue', () => {
    render(
      <AnalyticsSegmentWidgets
        data={{
          segmentSummary: {
            at_risk_count: 0,
            champions_count: 1,
            total_customers: 1,
            segments: [{ segment: 'Champions', count: 1, total_revenue: 800 }],
          },
        }}
        formatCurrency={(value) => `$${value}`}
        isWidgetVisible={(id) => id === 'champions-list'}
      />
    );

    expect(screen.getByText('Segment Revenue')).toBeInTheDocument();
    expect(screen.getByText('$800')).toBeInTheDocument();
  });
});
