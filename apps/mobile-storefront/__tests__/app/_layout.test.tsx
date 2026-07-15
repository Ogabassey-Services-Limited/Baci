import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type React from 'react';

const mockInitializeStorage = jest.fn<() => Promise<void>>();
const mockInitializeAuth = jest.fn<() => Promise<void>>();
const mockCleanup = jest.fn();
const mockRegisterPushNotifications = jest.fn();
const mockPrefetchStartupStorefrontData = jest.fn<() => Promise<void>>();
const mockActivateDueSavingsReminderNotification = jest.fn();
const mockInitializeAdTrackingForStartup = jest.fn<() => Promise<void>>();
const mockUseAppTrackingTransparency = jest.fn();
const mockRootLayoutNavMount = jest.fn();
const mockRootLayoutNavUnmount = jest.fn();
let mockTrackingAuthorizationSettled = true;
const mockAuthState = {
  cleanup: mockCleanup,
  initialize: mockInitializeAuth,
  isInitialized: true,
  merchantId: null as string | null,
  user: null as { id: string } | null,
};

jest.mock('../../global.css', () => ({}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/AnimatedSplash', () => ({
  AnimatedSplash: ({
    children,
    isVisible = true,
    onAnimationEnd,
  }: {
    children: React.ReactNode;
    isVisible?: boolean;
    onAnimationEnd: () => void;
  }) => {
    const { Pressable, View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <View testID="animated-splash-wrapper">
        {children}
        {isVisible ? (
          <Pressable testID="animated-splash" onPress={onAnimationEnd} />
        ) : null}
      </View>
    );
  },
}));

jest.mock('@/components/navigation/RootLayoutNav', () => ({
  RootLayoutNav: ({
    persistenceEnabled,
    shouldResumeNavigation,
  }: {
    persistenceEnabled: boolean;
    shouldResumeNavigation?: boolean;
  }) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    useEffect(() => {
      mockRootLayoutNavMount();
      return () => {
        mockRootLayoutNavUnmount();
      };
    }, []);

    return (
      <Text
        accessibilityLabel="Store navigation"
        accessibilityRole="text"
        testID="root-layout-nav"
      >
        persistence:{String(persistenceEnabled)};resume:
        {String(shouldResumeNavigation)}
      </Text>
    );
  },
}));

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorFallback: () => null,
}));

jest.mock('@/hooks/use-push-notifications', () => ({
  usePushNotifications: () => ({
    isLoading: false,
    isRegistered: false,
    register: mockRegisterPushNotifications,
    registeredUserId: null,
  }),
}));

jest.mock('@/hooks/use-app-tracking-transparency', () => ({
  useAppTrackingTransparency: (options: { enabled: boolean }) => {
    mockUseAppTrackingTransparency(options);
    return {
      isTrackingAuthorizationSettled: mockTrackingAuthorizationSettled,
    };
  },
}));

jest.mock('@/lib/offline-queue', () => ({
  offlineQueue: {
    destroy: jest.fn(),
    initialize: jest.fn(() => Promise.resolve()),
    registerHandler: jest.fn(),
  },
}));

jest.mock('@/lib/storage', () => ({
  DEFAULT_SYNC_STORAGE_KEYS: ['cart-storage'],
  initializeStorage: () => mockInitializeStorage(),
}));

jest.mock('@/lib/startup-storefront-prefetch', () => ({
  prefetchStartupStorefrontData: () => mockPrefetchStartupStorefrontData(),
}));

jest.mock('@/services/analytics', () => ({
  initAnalytics: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/initialize-ad-tracking-for-startup', () => ({
  initializeAdTrackingForStartup: () => mockInitializeAdTrackingForStartup(),
}));

jest.mock('@/services/orders', () => ({
  createOrder: jest.fn(),
}));

jest.mock('@/services/savings-reminder-notifications', () => ({
  activateDueSavingsReminderNotification:
    mockActivateDueSavingsReminderNotification,
}));

jest.mock('@/stores/auth-store', () => ({
  // useAuthStore is a Zustand-style mock: callable as a selector over
  // mockAuthState while also exposing getState() for direct store reads.
  useAuthStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector(mockAuthState),
    { getState: () => mockAuthState }
  ),
}));

const { default: RootLayout, resetRootLayoutBootstrapStateForTest } =
  require('@/app/_layout') as typeof import('@/app/_layout');

describe('RootLayout storage boot gate', () => {
  beforeEach(() => {
    resetRootLayoutBootstrapStateForTest();
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockInitializeAuth.mockResolvedValue(undefined);
    mockInitializeAdTrackingForStartup.mockResolvedValue(undefined);
    mockPrefetchStartupStorefrontData.mockResolvedValue(undefined);
    mockTrackingAuthorizationSettled = true;
    mockAuthState.isInitialized = true;
    mockAuthState.merchantId = null;
    mockAuthState.user = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not mount persisted navigation when the splash timeout fires before storage is ready', () => {
    mockInitializeStorage.mockReturnValue(new Promise(() => undefined));

    render(<RootLayout />);

    expect(mockPrefetchStartupStorefrontData).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('animated-splash')).toBeOnTheScreen();
    expect(screen.queryByTestId('root-layout-nav')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.queryByTestId('animated-splash')).toBeNull();
    expect(screen.queryByTestId('root-layout-nav')).toBeNull();
  });

  it('keeps the global auth subscription alive when the root view unmounts', async () => {
    mockInitializeStorage.mockResolvedValue(undefined);

    const { unmount } = render(<RootLayout />);

    await waitFor(() => {
      expect(mockInitializeStorage).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it('waits for ATT initialization before mounting navigation', async () => {
    let resolveAdTracking: () => void = () => {};
    mockInitializeStorage.mockResolvedValue(undefined);
    mockInitializeAdTrackingForStartup.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAdTracking = resolve;
      })
    );

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockInitializeAdTrackingForStartup).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('text', { name: 'Store navigation' })).toBeNull();

    await act(async () => {
      resolveAdTracking();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
  });

  it('keeps the navigator mounted when the startup splash finishes', async () => {
    mockInitializeStorage.mockResolvedValue(undefined);

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId('root-layout-nav')).toHaveTextContent(
        'persistence:false;resume:false'
      );
    });
    expect(mockRootLayoutNavMount).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('animated-splash'));

    await waitFor(() => {
      expect(screen.queryByTestId('animated-splash')).toBeNull();
    });
    expect(screen.getByTestId('root-layout-nav')).toHaveTextContent(
      'persistence:true;resume:true'
    );
    expect(mockRootLayoutNavMount).toHaveBeenCalledTimes(1);
    expect(mockRootLayoutNavUnmount).not.toHaveBeenCalled();
  });

  it('enables the root ATT coordinator only after storefront UI is visible', async () => {
    mockInitializeStorage.mockResolvedValue(undefined);

    render(<RootLayout />);

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
    expect(mockUseAppTrackingTransparency).toHaveBeenLastCalledWith({
      enabled: false,
    });

    fireEvent.press(screen.getByTestId('animated-splash'));

    await waitFor(() => {
      expect(mockUseAppTrackingTransparency).toHaveBeenLastCalledWith({
        enabled: true,
      });
    });
  });

  it('waits for ATT to settle before starting push registration', async () => {
    mockInitializeStorage.mockResolvedValue(undefined);
    mockTrackingAuthorizationSettled = false;
    mockAuthState.user = { id: 'review-user' };
    mockAuthState.merchantId = 'merchant-id';
    const view = render(<RootLayout />);

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
    fireEvent.press(screen.getByTestId('animated-splash'));
    await waitFor(() => {
      expect(mockUseAppTrackingTransparency).toHaveBeenLastCalledWith({
        enabled: true,
      });
    });
    expect(mockRegisterPushNotifications).not.toHaveBeenCalled();

    mockTrackingAuthorizationSettled = true;
    view.rerender(<RootLayout />);

    await waitFor(() => {
      expect(mockRegisterPushNotifications).toHaveBeenCalledWith(
        'review-user',
        'merchant-id'
      );
    });
  });

  it('waits for ATT to settle before activating a due savings reminder', async () => {
    mockInitializeStorage.mockResolvedValue(undefined);
    mockTrackingAuthorizationSettled = false;
    const view = render(<RootLayout />);

    await waitFor(() => {
      expect(
        screen.getByRole('text', { name: 'Store navigation' })
      ).toBeOnTheScreen();
    });
    expect(mockActivateDueSavingsReminderNotification).not.toHaveBeenCalled();

    mockTrackingAuthorizationSettled = true;
    view.rerender(<RootLayout />);

    await waitFor(() => {
      expect(mockActivateDueSavingsReminderNotification).toHaveBeenCalledTimes(
        1
      );
    });
  });

  it('does not replay the animated splash after a completed boot remount', async () => {
    mockInitializeStorage.mockResolvedValue(undefined);

    const firstRender = render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId('root-layout-nav')).toHaveTextContent(
        'persistence:false;resume:false'
      );
    });

    fireEvent.press(screen.getByTestId('animated-splash'));

    await waitFor(() => {
      expect(screen.queryByTestId('animated-splash')).toBeNull();
    });
    expect(screen.getByTestId('root-layout-nav')).toHaveTextContent(
      'persistence:true;resume:true'
    );

    firstRender.unmount();
    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId('root-layout-nav')).toHaveTextContent(
        'persistence:true;resume:true'
      );
    });
    expect(screen.queryByTestId('animated-splash')).toBeNull();
  });
});
