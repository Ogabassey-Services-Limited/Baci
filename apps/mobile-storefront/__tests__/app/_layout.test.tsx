import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type React from 'react';
import RootLayout from '@/app/_layout';

const mockInitializeStorage = jest.fn<() => Promise<void>>();
const mockInitializeAuth = jest.fn<() => Promise<void>>();
const mockCleanup = jest.fn();
const mockRegisterPushNotifications = jest.fn();
const mockPrefetchStartupStorefrontData = jest.fn<() => Promise<void>>();

jest.mock('../../global.css', () => ({}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/AnimatedSplash', () => ({
  AnimatedSplash: ({ children }: { children: React.ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View testID="animated-splash">{children}</View>;
  },
}));

jest.mock('@/components/navigation/RootLayoutNav', () => ({
  RootLayoutNav: ({ persistenceEnabled }: { persistenceEnabled: boolean }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Text testID="root-layout-nav">
        persistence:{String(persistenceEnabled)}
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

jest.mock('@/services/ad-tracking', () => ({
  initAdTracking: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/orders', () => ({
  createOrder: jest.fn(),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      cleanup: mockCleanup,
      initialize: mockInitializeAuth,
      isInitialized: true,
      merchantId: null,
      user: null,
    }),
}));

describe('RootLayout storage boot gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockInitializeAuth.mockResolvedValue(undefined);
    mockPrefetchStartupStorefrontData.mockResolvedValue(undefined);
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
});
