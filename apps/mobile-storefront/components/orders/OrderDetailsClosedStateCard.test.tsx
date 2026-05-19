import { render, screen } from '@testing-library/react-native';
import { getCustomerOrderStatusMeta } from '@/lib/customer-order-status';
import { OrderDetailsClosedStateCard } from './OrderDetailsClosedStateCard';

const statusPalette = {
  accent: '#dc2626',
  border: 'rgba(220, 38, 38, 0.18)',
  surface: 'rgba(220, 38, 38, 0.10)',
} as const;

describe('OrderDetailsClosedStateCard', () => {
  it('renders the closed status label and description', () => {
    const statusMeta = getCustomerOrderStatusMeta('cancelled');

    render(
      <OrderDetailsClosedStateCard
        statusMeta={statusMeta}
        statusPalette={statusPalette}
        textSecondaryColor="#6b7280"
      />
    );

    expect(screen.getByText(statusMeta.label)).toBeTruthy();
    expect(screen.getByText(statusMeta.description)).toBeTruthy();
  });
});
