import { fireEvent, render, screen } from '@testing-library/react-native';
import { OrderDetailsActionsCard } from './OrderDetailsActionsCard';

const colors = {
  border: '#e5e7eb',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrderDetailsActionsCard', () => {
  it('renders available order actions and calls the matching handlers', () => {
    const onCallRider = jest.fn();
    const onLeaveGoogleReview = jest.fn();
    const onOpenReceipt = jest.fn();
    const onReturnOrder = jest.fn();

    render(
      <OrderDetailsActionsCard
        canLeaveReview
        canReturnOrder
        canShowRiderContact
        colors={colors}
        isDark={false}
        isReceiptReady
        onCallRider={onCallRider}
        onLeaveGoogleReview={onLeaveGoogleReview}
        onOpenReceipt={onOpenReceipt}
        onReturnOrder={onReturnOrder}
        riderPhoneNumber="+2348012345678"
      />
    );

    expect(screen.getByText('Actions')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /view receipt/i }));
    fireEvent.press(
      screen.getByRole('button', { name: /call rider \+2348012345678/i })
    );
    fireEvent.press(
      screen.getByRole('button', { name: /leave a google review/i })
    );
    fireEvent.press(screen.getByRole('button', { name: /return order/i }));

    expect(onOpenReceipt).toHaveBeenCalledTimes(1);
    expect(onCallRider).toHaveBeenCalledTimes(1);
    expect(onLeaveGoogleReview).toHaveBeenCalledTimes(1);
    expect(onReturnOrder).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when no order actions are available', () => {
    render(
      <OrderDetailsActionsCard
        canLeaveReview={false}
        canReturnOrder={false}
        canShowRiderContact={false}
        colors={colors}
        isDark={false}
        isReceiptReady={false}
        onCallRider={jest.fn()}
        onLeaveGoogleReview={jest.fn()}
        onOpenReceipt={jest.fn()}
        onReturnOrder={jest.fn()}
      />
    );

    expect(screen.queryByText('Actions')).toBeNull();
  });

  it('does not render the rider action without a phone number', () => {
    render(
      <OrderDetailsActionsCard
        canLeaveReview={false}
        canReturnOrder={false}
        canShowRiderContact
        colors={colors}
        isDark={false}
        isReceiptReady={false}
        onCallRider={jest.fn()}
        onLeaveGoogleReview={jest.fn()}
        onOpenReceipt={jest.fn()}
        onReturnOrder={jest.fn()}
      />
    );

    expect(screen.queryByText('Actions')).toBeNull();
    expect(screen.queryByRole('button', { name: /call rider/i })).toBeNull();
  });
});
