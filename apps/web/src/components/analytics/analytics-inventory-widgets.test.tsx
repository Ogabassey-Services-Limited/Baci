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
});
