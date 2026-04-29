import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { PaymentErrorView } from './PaymentErrorView';

const mockStackScreen = jest.fn((_props: unknown) => null);

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: unknown) => mockStackScreen(props),
  },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('PaymentErrorView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('guards retry against repeated taps while retry is in flight', async () => {
    const retry = deferred();
    const onRetry = jest.fn(() => retry.promise);

    render(
      <PaymentErrorView
        colors={Colors.light}
        errorMessage="Gateway unavailable"
        gatewayName="Paystack"
        onBack={jest.fn()}
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByLabelText('Try payment again');

    fireEvent.press(retryButton);
    fireEvent.press(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(retryButton.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });

    retry.resolve();

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeOnTheScreen();
    });
  });
});
