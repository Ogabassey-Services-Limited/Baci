import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderReportStatsPanel } from '@/components/ui/order-report-modal/OrderReportStatsPanel';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      info: '#3b82f6',
      infoLight: '#dbeafe',
      success: '#16a34a',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      warning: '#f59e0b',
    },
  }),
}));

vi.mock('@/utils/format', () => ({
  formatCurrency: (amount: number) => `NGN ${amount}`,
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('OrderReportStatsPanel', () => {
  it('renders the report summary stats and export scope note', () => {
    render(
      <OrderReportStatsPanel
        stats={{
          completedCount: 1,
          pendingCount: 2,
          totalOrders: 3,
          totalRevenue: 54000,
        }}
      />
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('NGN 54000')).toBeInTheDocument();
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(
      screen.getByText('Exporting will capture all 3 currently loaded orders.')
    ).toBeInTheDocument();
  });
});
