import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeAuthStore: vi.fn(() => vi.fn()),
  initAdminAnalytics: vi.fn(),
  isRuntimePlatform: vi.fn(() => false),
  navigationBarSetStyle: vi.fn(),
  splashHideAsync: vi.fn(),
  useFonts: vi.fn(() => [true, null] as const),
  useRevenueCat: vi.fn(),
}));

vi.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular: 400,
  Inter_500Medium: 500,
  Inter_600SemiBold: 600,
  Inter_700Bold: 700,
  Inter_800ExtraBold: 800,
}));

vi.mock('expo-font', () => ({
  useFonts: mocks.useFonts,
}));

vi.mock('expo-navigation-bar', () => ({
  setStyle: mocks.navigationBarSetStyle,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Slot: () => React.createElement('div', { role: 'main' }, 'admin root'),
  };
});

vi.mock('expo-router/react-navigation', async () => {
  const React = await import('react');
  return {
    DarkTheme: { colors: {} },
    DefaultTheme: { colors: {} },
    ThemeProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-splash-screen', () => ({
  default: {
    hideAsync: mocks.splashHideAsync,
    preventAutoHideAsync: vi.fn(),
  },
  hideAsync: mocks.splashHideAsync,
  preventAutoHideAsync: vi.fn(),
}));

vi.mock('react-native-reanimated', () => ({}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    StatusBar: () => null,
    useColorScheme: () => 'light',
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-gesture-handler', async () => {
  const React = await import('react');
  return {
    GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/components/updates/MobileUpdateController', () => ({
  MobileUpdateController: () => <div>mobile update controller</div>,
}));

vi.mock('@/config/runtime-platform', () => ({
  isRuntimePlatform: mocks.isRuntimePlatform,
}));

vi.mock('@/context/NetworkContext', async () => {
  const React = await import('react');
  return {
    NetworkProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/context/OnboardingContext', async () => {
  const React = await import('react');
  return {
    OnboardingProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: mocks.useRevenueCat,
}));

vi.mock('@/lib/QueryProvider', async () => {
  const React = await import('react');
  return {
    QueryProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/services/analytics-core', () => ({
  initAdminAnalytics: mocks.initAdminAnalytics,
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ initialize: mocks.initializeAuthStore }),
  },
}));

import RootLayout from './_layout';

describe('mobile-admin RootLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useFonts.mockReturnValue([true, null]);
    mocks.isRuntimePlatform.mockReturnValue(false);
  });

  it('initializes admin analytics and auth once after mounting', async () => {
    render(<RootLayout />);

    expect(screen.getByRole('main').textContent).toBe('admin root');

    await waitFor(() => {
      expect(mocks.initAdminAnalytics).toHaveBeenCalledTimes(1);
      expect(mocks.initializeAuthStore).toHaveBeenCalledTimes(1);
    });
  });
});
