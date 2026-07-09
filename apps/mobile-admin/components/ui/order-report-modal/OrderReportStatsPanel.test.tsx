import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderReportStatsPanel } from '@/components/ui/order-report-modal/OrderReportStatsPanel';

const mocks = vi.hoisted(() => ({
  format: vi.fn((amount: number) => `NGN ${amount}`),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
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

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'NGN',
    format: mocks.format,
    formatCompact: mocks.format,
    symbol: '₦',
  }),
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('OrderReportStatsPanel', () => {
  beforeEach(() => {
    mocks.format.mockClear();
    mocks.format.mockImplementation((amount: number) => `NGN ${amount}`);
  });

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

  it('formats total revenue through the merchant-currency-aware hook with no decimals', () => {
    render(
      <OrderReportStatsPanel
        stats={{
          completedCount: 0,
          pendingCount: 0,
          totalOrders: 0,
          totalRevenue: 54000,
        }}
      />
    );

    expect(mocks.format).toHaveBeenCalledWith(54000, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
  });

  it('renders whatever currency the merchant-aware hook resolves, not a hardcoded NGN string', () => {
    mocks.format.mockImplementation((amount: number) => `₹ ${amount}`);

    render(
      <OrderReportStatsPanel
        stats={{
          completedCount: 0,
          pendingCount: 0,
          totalOrders: 0,
          totalRevenue: 12000,
        }}
      />
    );

    expect(screen.getByText('₹ 12000')).toBeInTheDocument();
    expect(screen.queryByText('NGN 12000')).not.toBeInTheDocument();
  });
});
