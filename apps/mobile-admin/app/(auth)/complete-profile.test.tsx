import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    StatusBar: () => null,
    StyleSheet: {
      absoluteFill: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});
vi.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('@/components/ui/AppFormScreen', async () => {
  const React = await import('react');
  return {
    AppFormScreen: ({
      children,
      header,
    }: {
      children?: React.ReactNode;
      header?: React.ReactNode;
    }) => (
      <>
        {header}
        {children}
      </>
    ),
  };
});
vi.mock('@/components/auth/register/MerchantSetupForm', () => ({
  MerchantSetupForm: () => <div>merchant setup form</div>,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'ada@example.com',
      user_metadata: { first_name: 'Ada' },
    },
  }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      primary: '#111',
      text: '#111',
    },
    isDark: false,
  }),
}));

import CompleteProfileScreen from './complete-profile';

describe('CompleteProfileScreen', () => {
  it('hosts authenticated merchant setup without a second registration path', () => {
    render(<CompleteProfileScreen />);

    expect(screen.getByText('Complete Setup')).toBeTruthy();
    expect(screen.queryByText('Welcome, Ada!')).toBeNull();
    expect(screen.getByText('merchant setup form')).toBeTruthy();
  });
});
