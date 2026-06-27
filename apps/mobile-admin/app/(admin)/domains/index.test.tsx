import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DomainsDashboard from './index';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement('button', { onClick: () => onPress?.() }, children),
    RefreshControl: () => null,
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StatusBar: () => null,
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: { Screen: () => React.createElement('div') },
    useRouter: () => ({ back: mocks.back, push: mocks.push }),
  };
});

vi.mock('@/components/domains/DomainEmptyState', () => ({
  DomainEmptyState: () => <div>Domain empty state</div>,
}));

vi.mock('@/components/domains/DomainItemCard', () => ({
  DomainItemCard: ({ domain }: { domain: { domain: string } }) => (
    <div>{domain.domain}</div>
  ),
}));

vi.mock('@/components/domains/DomainOptionsSheet', () => ({
  default: () => null,
}));

vi.mock('@/components/domains/StoreLinkCard', () => ({
  StoreLinkCard: () => <div>Store link</div>,
}));

vi.mock('@/hooks/useDomainActions', () => ({
  useDomainActions: () => ({
    actionLoading: null,
    handleOptionAction: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', slug: 'ogabassey' },
    primaryDomain: null,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#e5e7eb',
      card: '#fff',
      error: '#dc2626',
      errorLight: '#fee2e2',
      primary: '#2563eb',
      text: '#111827',
      textSecondary: '#4b5563',
    },
    isDark: false,
    shadows: { lg: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

describe('DomainsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockReturnValue({
      data: [],
      error: null,
      isLoading: true,
      isRefetching: false,
      refetch: mocks.refetch,
    });
  });

  it('renders the domains dashboard loading shell', () => {
    render(<DomainsDashboard />);

    expect(screen.getByText('Domains')).toBeTruthy();
    expect(screen.getByText('CUSTOM DOMAINS')).toBeTruthy();
    expect(screen.getByText('Loading domains…')).toBeTruthy();
  });
});
