import { expect, it } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { Mock } from 'jest-mock';
import type React from 'react';

interface AuthState {
  merchantId: string | null;
  user: { id: string } | null;
}

interface AttTestDependencies {
  RootLayout: React.ComponentType;
  authState: AuthState;
  initializeStorage: Mock<() => Promise<void>>;
  initializeAdTrackingForStartup: Mock<() => Promise<void>>;
  registerPushNotifications: Mock;
  activateDueSavingsReminderNotification: Mock;
  useAppTrackingTransparency: Mock;
  setTrackingAuthorizationSettled: (settled: boolean) => void;
}

export function registerRootLayoutAttTests({
  RootLayout,
  authState,
  initializeStorage,
  initializeAdTrackingForStartup,
  registerPushNotifications,
  activateDueSavingsReminderNotification,
  useAppTrackingTransparency,
  setTrackingAuthorizationSettled,
}: AttTestDependencies) {
  it('waits for ATT initialization before mounting navigation', async () => {
    let resolveAdTracking: (() => void) | undefined;
    initializeStorage.mockResolvedValue(undefined);
    initializeAdTrackingForStartup.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAdTracking = resolve;
      })
    );

    render(<RootLayout />);

    await waitFor(() => {
      expect(initializeAdTrackingForStartup).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('text', { name: 'Store navigation' })).toBeNull();

    await act(async () => {
      resolveAdTracking?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
  });

  it('enables the root ATT coordinator only after storefront UI is visible', async () => {
    initializeStorage.mockResolvedValue(undefined);
    render(<RootLayout />);

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
    expect(useAppTrackingTransparency).toHaveBeenLastCalledWith({
      enabled: false,
    });

    fireEvent.press(screen.getByTestId('animated-splash'));

    await waitFor(() => {
      expect(useAppTrackingTransparency).toHaveBeenLastCalledWith({
        enabled: true,
      });
    });
  });

  it('waits for ATT to settle before starting push registration', async () => {
    initializeStorage.mockResolvedValue(undefined);
    setTrackingAuthorizationSettled(false);
    authState.user = { id: 'review-user' };
    authState.merchantId = 'merchant-id';
    const view = render(<RootLayout />);

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('animated-splash'));
    await waitFor(() => {
      expect(useAppTrackingTransparency).toHaveBeenLastCalledWith({
        enabled: true,
      });
    });
    expect(registerPushNotifications).not.toHaveBeenCalled();

    setTrackingAuthorizationSettled(true);
    view.rerender(<RootLayout />);

    await waitFor(() => {
      expect(registerPushNotifications).toHaveBeenCalledWith(
        'review-user',
        'merchant-id'
      );
    });
  });

  it('waits for ATT to settle before activating a due savings reminder', async () => {
    initializeStorage.mockResolvedValue(undefined);
    setTrackingAuthorizationSettled(false);
    const view = render(<RootLayout />);

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
    expect(activateDueSavingsReminderNotification).not.toHaveBeenCalled();

    setTrackingAuthorizationSettled(true);
    view.rerender(<RootLayout />);

    await waitFor(() => {
      expect(activateDueSavingsReminderNotification).toHaveBeenCalledTimes(1);
    });
  });
}
