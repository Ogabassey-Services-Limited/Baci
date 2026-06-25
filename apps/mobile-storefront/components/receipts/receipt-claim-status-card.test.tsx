import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReceiptClaimStatusCard } from './receipt-claim-status-card';

const colors = {
  border: '#e5e7eb',
  error: '#ef4444',
  primaryForeground: '#ffffff',
  text: '#111827',
  textSecondary: '#4b5563',
  tint: '#dc2626',
};

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <Text>{name}</Text>;
  },
}));

describe('ReceiptClaimStatusCard', () => {
  it('renders the receipt-ready copy and current status message', () => {
    const { UNSAFE_getByProps } = render(
      <ReceiptClaimStatusCard
        colors={colors}
        message="Securing this receipt..."
        onRetry={jest.fn()}
        status="claiming"
      />
    );

    expect(screen.getByText('Your receipt is ready.')).toBeOnTheScreen();
    const statusMessage = screen.getByText('Securing this receipt...');

    expect(statusMessage).toBeOnTheScreen();
    expect(
      UNSAFE_getByProps({
        accessibilityLiveRegion: 'polite',
        accessibilityRole: 'none',
      })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows a retry button when the claim enters an error state', () => {
    const onRetry = jest.fn();

    render(
      <ReceiptClaimStatusCard
        colors={colors}
        message="A network error occurred."
        onRetry={onRetry}
        status="error"
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
