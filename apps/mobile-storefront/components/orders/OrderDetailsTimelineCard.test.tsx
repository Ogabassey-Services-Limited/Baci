import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  getCustomerOrderStatusMeta,
  getCustomerOrderStatusPalette,
} from '@/lib/customer-order-status';
import { OrderDetailsTimelineCard } from './OrderDetailsTimelineCard';

const colors = {
  border: '#e5e7eb',
  card: '#ffffff',
  muted: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrderDetailsTimelineCard', () => {
  it('renders timeline steps and status summary', () => {
    const statusMeta = getCustomerOrderStatusMeta('processing');
    const statusPalette = getCustomerOrderStatusPalette('processing');

    render(
      <OrderDetailsTimelineCard
        shippingStatus="processing"
        statusMeta={statusMeta}
        statusPalette={statusPalette}
        colors={colors}
        onTrackOrder={jest.fn()}
      />
    );

    expect(screen.getByText('Order Status')).toBeTruthy();
    expect(screen.getByText('Placed')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('Shipped')).toBeTruthy();
    expect(screen.getByText('Delivered')).toBeTruthy();
    expect(screen.getByText(statusMeta.label)).toBeTruthy();
    expect(screen.getByText(statusMeta.description)).toBeTruthy();
  });

  it('shows track button only when tracking number is available', () => {
    const onTrackOrder = jest.fn();
    const statusMeta = getCustomerOrderStatusMeta('shipped');
    const statusPalette = getCustomerOrderStatusPalette('shipped');

    const { rerender } = render(
      <OrderDetailsTimelineCard
        shippingStatus="shipped"
        statusMeta={statusMeta}
        statusPalette={statusPalette}
        colors={colors}
        onTrackOrder={onTrackOrder}
      />
    );

    expect(screen.queryByRole('button', { name: /track order/i })).toBeNull();

    rerender(
      <OrderDetailsTimelineCard
        shippingStatus="shipped"
        statusMeta={statusMeta}
        statusPalette={statusPalette}
        colors={colors}
        trackingNumber="TRACK123"
        onTrackOrder={onTrackOrder}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: /track order/i }));
    expect(onTrackOrder).toHaveBeenCalledTimes(1);
  });
});
