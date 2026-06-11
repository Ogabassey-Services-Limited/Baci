import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileScreen from './profile';

const mocks = vi.hoisted(() => ({
  getManagementLabel: vi.fn(() => 'Manage from helper'),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({ back: vi.fn() }),
    Stack: {
      Screen: () => React.createElement('div', null),
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
  }),
  useQuery: () => ({
    data: {
      email: 'owner@baci.test',
      id: 'staff-1',
      name: 'Baci Owner',
      phone: '08012345678',
      role: 'owner',
    },
    isLoading: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    unregisterPush: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    isPro: true,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#64748b',
      textOnPrimary: '#ffffff',
      textSecondary: '#334155',
    },
    isDark: false,
  }),
}));

vi.mock('@/utils/SubscriptionManagement', () => ({
  SubscriptionManagement: {
    getManagementLabel: mocks.getManagementLabel,
    getPlanLabel: () => 'Baci Pro',
    openNativeManagement: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <Text>loading</Text>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    StatusBar: () => null,
    ActivityIndicator: () => <MockText>loading</MockText>,
    Alert: { alert: vi.fn() },
    Pressable: ({ children }: { children?: ReactNode }) => (
      <button type="button">{children}</button>
    ),
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: MockText,
    TextInput: ({ value }: { value?: string }) => (
      <input value={value ?? ''} readOnly />
    ),
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => <Text>icon</Text>,

  default: () => <Text>icon</Text>,
  __esModule: true,
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    mocks.getManagementLabel.mockReset();
    mocks.getManagementLabel.mockReturnValue('Manage from helper');
  });

  it('renders management CTA label from SubscriptionManagement helper', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Manage from helper')).toBeInTheDocument();
  });

  it('falls back to default management label when helper output is empty', () => {
    mocks.getManagementLabel.mockReturnValue('');

    render(<ProfileScreen />);

    expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
  });
});
