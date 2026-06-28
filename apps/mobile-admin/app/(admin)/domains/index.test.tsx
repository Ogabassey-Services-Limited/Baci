import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DomainsDashboard from './index';

const mocks = vi.hoisted(() => ({
  handleOptionAction: vi.fn(),
  queryState: {
    data: [
      {
        created_at: '2026-06-01T00:00:00.000Z',
        domain: 'shop.example.com',
        domain_type: 'custom',
        id: 'domain-1',
        is_primary: true,
        status: 'active',
      },
    ],
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  },
  router: {
    back: vi.fn(),
    push: vi.fn(),
  },
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: {
      Screen: () => React.createElement('div'),
    },
    useRouter: () => mocks.router,
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.queryState,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  RefreshControl: () => null,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StatusBar: () => null,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/components/domains/DomainEmptyState', () => ({
  DomainEmptyState: ({
    onBuyDomain,
    onConnectDomain,
  }: {
    onBuyDomain: () => void;
    onConnectDomain: () => void;
  }) => (
    <div>
      <button onClick={onBuyDomain} type="button">
        Buy a domain
      </button>
      <button onClick={onConnectDomain} type="button">
        Connect a domain
      </button>
    </div>
  ),
}));

vi.mock('@/components/domains/DomainItemCard', () => ({
  DomainItemCard: ({
    domain,
    onOpenOptions,
  }: {
    domain: { domain: string };
    onOpenOptions: (domain: { domain: string }) => void;
  }) => (
    <button onClick={() => onOpenOptions(domain)} type="button">
      {domain.domain}
    </button>
  ),
}));

vi.mock('@/components/domains/DomainOptionsSheet', () => ({
  default: ({ visible }: { visible?: boolean }) =>
    visible ? <div>Domain options</div> : null,
}));

vi.mock('@/components/domains/StoreLinkCard', () => ({
  StoreLinkCard: ({
    merchantSlug,
    primaryDomain,
  }: {
    merchantSlug?: string;
    primaryDomain?: string;
  }) => (
    <div>Store link {primaryDomain ?? merchantSlug ?? 'not configured'}</div>
  ),
}));

vi.mock('@/hooks/useDomainActions', () => ({
  useDomainActions: () => ({
    actionLoading: false,
    handleOptionAction: mocks.handleOptionAction,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', slug: 'baci-test' },
    primaryDomain: {
      domain: 'store.baci.test',
      domain_type: 'subdomain',
      id: 'primary-domain',
      is_primary: true,
      status: 'active',
    },
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      errorLight: '#fee2e2',
      primary: '#2563eb',
      text: '#0f172a',
      textSecondary: '#475569',
    },
    isDark: false,
    shadows: { lg: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('DomainsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryState.data = [
      {
        created_at: '2026-06-01T00:00:00.000Z',
        domain: 'shop.example.com',
        domain_type: 'custom',
        id: 'domain-1',
        is_primary: true,
        status: 'active',
      },
    ];
    mocks.queryState.error = null;
    mocks.queryState.isLoading = false;
  });

  it('renders merchant domain rows', () => {
    render(<DomainsDashboard />);

    expect(screen.getByText('Domains')).toBeTruthy();
    expect(screen.getByText('CUSTOM DOMAINS')).toBeTruthy();
    expect(screen.getByText('shop.example.com')).toBeTruthy();
    expect(screen.getByText(/Store link store\.baci\.test/i)).toBeTruthy();
  });

  it('routes empty-state actions to domain setup flows', () => {
    mocks.queryState.data = [];

    render(<DomainsDashboard />);

    fireEvent.click(screen.getByText('Buy a domain'));
    fireEvent.click(screen.getByText('Connect a domain'));

    expect(mocks.router.push).toHaveBeenCalledWith('/domains/buy');
    expect(mocks.router.push).toHaveBeenCalledWith('/domains/connect');
  });
});
