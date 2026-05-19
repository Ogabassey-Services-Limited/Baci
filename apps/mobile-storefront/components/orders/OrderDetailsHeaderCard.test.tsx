import { render, screen } from '@testing-library/react-native';
import { getCustomerOrderStatusMeta } from '@/lib/customer-order-status';
import { OrderDetailsHeaderCard } from './OrderDetailsHeaderCard';

const colors = {
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

const statusPalette = {
  accent: '#2563eb',
  surface: 'rgba(37, 99, 235, 0.10)',
} as const;

const formatDate = () => '19 May 2026, 09:45 AM';

describe('OrderDetailsHeaderCard', () => {
  it('renders order number, status chip, and status description', () => {
    const statusMeta = getCustomerOrderStatusMeta('shipped');

    render(
      <OrderDetailsHeaderCard
        orderNumber="12345"
        createdAt="2026-05-19T08:45:00.000Z"
        statusMeta={statusMeta}
        statusPalette={statusPalette}
        colors={colors}
        formatDate={formatDate}
      />
    );

    expect(screen.getByText('Order #12345')).toBeTruthy();
    expect(screen.getByText(statusMeta.shortLabel)).toBeTruthy();
    expect(screen.getByText('19 May 2026, 09:45 AM')).toBeTruthy();
    expect(screen.getByText(statusMeta.description)).toBeTruthy();
  });
});
