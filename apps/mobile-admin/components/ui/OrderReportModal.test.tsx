import '@testing-library/jest-dom/vitest';
import type { Order } from '@baci/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderReportModal from '@/components/ui/OrderReportModal';

const mocks = vi.hoisted(() => ({
  exportOrderReportPDF: vi.fn(),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      info: '#3b82f6',
      infoLight: '#dbeafe',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      success: '#16a34a',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#cbd5e1',
      warning: '#f59e0b',
    },
    shadows: {
      lg: {},
      md: {},
    },
  }),
}));

vi.mock('@/utils/export-orders', () => ({
  orderExportTools: {
    exportOrderReportPDF: mocks.exportOrderReportPDF,
  },
}));

vi.mock('@/utils/format', () => ({
  formatCurrency: (amount: number) => `NGN ${amount}`,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Dimensions: {
    get: () => ({ height: 800, width: 400 }),
  },
  Modal: ({ children, visible }: { children?: ReactNode; visible: boolean }) =>
    visible ? (
      <section aria-label="order-report-modal">{children}</section>
    ) : null,
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: (event: { stopPropagation: () => void }) => void;
  }) => (
    <div
      aria-label={accessibilityLabel}
      onKeyDown={() => undefined}
      onClick={(event) =>
        onPress?.({ stopPropagation: () => event.stopPropagation() })
      }
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('OrderReportModal', () => {
  const baseOrders: Order[] = [
    {
      created_at: '2026-05-12T00:00:00.000Z',
      currency: 'NGN',
      customer_email: 'ada@example.com',
      customer_name: 'Ada',
      customer_phone: null,
      discount_amount: 0,
      id: 'order-1',
      merchant_id: 'merchant-1',
      notes: null,
      order_number: 'ORD-001',
      payment_method: 'bank-transfer',
      payment_status: 'pending',
      shipping_fee: 0,
      shipping_status: 'pending',
      source: 'website',
      subtotal: 12000,
      tax_amount: 0,
      total: 12000,
      updated_at: '2026-05-12T00:00:00.000Z',
    },
    {
      created_at: '2026-05-12T00:00:00.000Z',
      currency: 'NGN',
      customer_email: 'bola@example.com',
      customer_name: 'Bola',
      customer_phone: null,
      discount_amount: 0,
      id: 'order-2',
      merchant_id: 'merchant-1',
      notes: null,
      order_number: 'ORD-002',
      payment_method: 'card',
      payment_status: 'paid',
      shipping_fee: 0,
      shipping_status: 'delivered',
      source: 'website',
      subtotal: 8000,
      tax_amount: 0,
      total: 8000,
      updated_at: '2026-05-12T00:00:00.000Z',
    },
  ];

  const baseProps = {
    visible: true,
    onClose: vi.fn(),
    onExport: vi.fn().mockResolvedValue(undefined),
    orders: baseOrders,
    dateRangeLabel: 'Last 7 Days',
    businessName: 'Ogabassey',
    logoUrl: 'https://example.com/logo.png',
    onDateSelect: vi.fn(),
    onPresetSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the summary stats for the current date range', () => {
    render(<OrderReportModal {...baseProps} />);

    expect(screen.getByLabelText('order-report-modal')).toBeInTheDocument();
    expect(screen.getByText('Orders Report')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('NGN 20000')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('keeps the report date context visible without date controls', () => {
    const propsWithoutDateControls = {
      visible: baseProps.visible,
      onClose: baseProps.onClose,
      onExport: baseProps.onExport,
      orders: baseProps.orders,
      dateRangeLabel: baseProps.dateRangeLabel,
      businessName: baseProps.businessName,
      logoUrl: baseProps.logoUrl,
    };

    render(<OrderReportModal {...propsWithoutDateControls} />);

    expect(screen.getByText('Summary for:')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Change date range' })
    ).not.toBeInTheDocument();
  });

  it('opens the preset menu and routes preset and custom date actions', () => {
    render(<OrderReportModal {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change date range' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Select Last 30 Days' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Change date range' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Select custom date range' })
    );

    expect(baseProps.onPresetSelect).toHaveBeenCalledWith('Last 30 Days');
    expect(baseProps.onDateSelect).toHaveBeenCalledTimes(1);
  });

  it('exports CSV through the provided handler and closes on success', async () => {
    render(<OrderReportModal {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export as CSV' }));

    await waitFor(() => {
      expect(baseProps.onExport).toHaveBeenCalledTimes(1);
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('exports the PDF report with the current report context and closes', async () => {
    mocks.exportOrderReportPDF.mockResolvedValue(undefined);

    render(<OrderReportModal {...baseProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Download PDF Report' })
    );

    await waitFor(() => {
      expect(mocks.exportOrderReportPDF).toHaveBeenCalledWith(
        baseProps.orders,
        'Last 7 Days',
        'Ogabassey',
        'https://example.com/logo.png'
      );
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
