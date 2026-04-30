import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('guards retry against repeated taps while retry is in flight', async () => {
    const retry = deferred();
    const onRetry = jest.fn((_signal: AbortSignal) => retry.promise);

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
    expect(onRetry).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(retryButton.props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });

    retry.resolve();

    await waitFor(() => {
      expect(screen.getByLabelText('Try payment again')).toBeEnabled();
    });
  });

  it('aborts an in-flight retry when unmounted', () => {
    const retry = deferred();
    const onRetry = jest.fn((_signal: AbortSignal) => retry.promise);
    const { unmount } = render(
      <PaymentErrorView
        colors={Colors.light}
        errorMessage="Gateway unavailable"
        gatewayName="Paystack"
        onBack={jest.fn()}
        onRetry={onRetry}
      />
    );

    fireEvent.press(screen.getByLabelText('Try payment again'));
    const signal = onRetry.mock.calls[0]?.[0];

    expect(signal).toBeDefined();
    if (!signal) {
      throw new Error('Expected retry signal to be provided');
    }
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('logs retry failures and restores the retry button', async () => {
    const retryError = new Error('retry failed');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onRetry = jest.fn((_signal: AbortSignal) =>
      Promise.reject(retryError)
    );

    render(
      <PaymentErrorView
        colors={Colors.light}
        errorMessage="Gateway unavailable"
        gatewayName="Paystack"
        onBack={jest.fn()}
        onRetry={onRetry}
      />
    );

    fireEvent.press(screen.getByLabelText('Try payment again'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Payment retry failed:',
        retryError
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Try payment again')).toBeEnabled();
    });
  });
});
