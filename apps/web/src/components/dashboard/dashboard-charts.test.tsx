import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RevenueSparkline } from './dashboard-charts';

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="chart-container">
      {children}
    </div>
  ),
}));

vi.mock('recharts', () => ({
  Area: () => <div data-testid="area" />,
  AreaChart: ({ height, width }: { height?: number; width?: number }) => (
    <div data-height={height} data-testid="area-chart" data-width={width} />
  ),
  Bar: () => null,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('RevenueSparkline', () => {
  it('lets ChartContainer provide the chart dimensions', () => {
    render(
      <RevenueSparkline
        config={{ revenue: { label: 'Revenue' } }}
        data={[{ month: 'May', orders: 2, profit: 50, revenue: 100 }]}
      />
    );

    expect(screen.getByTestId('chart-container')).toHaveClass('min-h-[100px]');
    expect(screen.getByTestId('area-chart')).not.toHaveAttribute('data-width');
    expect(screen.getByTestId('area-chart')).not.toHaveAttribute('data-height');
  });
});
