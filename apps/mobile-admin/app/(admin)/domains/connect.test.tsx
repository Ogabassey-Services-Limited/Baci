import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectDomainScreen from './connect';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  formScreenProps: {
    keyboardOffsetPreset: 'default' as 'default' | 'compactHeader',
  },
  getSession: vi.fn(),
  router: {
    dismissAll: vi.fn(),
    push: vi.fn(),
  },
  subscription: {
    isPro: true,
    merchant: {
      plan_tier: 'pro',
      premium_features: [],
    },
  },
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => mocks.router,
    Stack: Object.assign(
      ({ children }: { children?: React.ReactNode }) => children,
      {
        Screen: () => React.createElement('div', null),
      }
    ),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textSecondary: '#334155',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: false,
    merchant: mocks.subscription.merchant,
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    isPro: mocks.subscription.isPro,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({
    children,
    keyboardOffsetPreset,
  }: {
    children?: ReactNode;
    keyboardOffsetPreset?: 'default' | 'compactHeader';
  }) => {
    mocks.formScreenProps.keyboardOffsetPreset =
      keyboardOffsetPreset ?? 'default';
    return <section aria-label="connect-domain-form">{children}</section>;
  },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),

  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <output aria-label="loading" />,
  Alert: { alert: mocks.alert },
  Platform: { OS: 'web' },
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
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    onChangeText,
    placeholder,
    value,
  }: {
    onChangeText?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

describe('ConnectDomainScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
    });
    mocks.subscription.isPro = true;
    mocks.subscription.merchant = {
      plan_tier: 'pro',
      premium_features: [],
    };
  });

  it('uses compact keyboard offset preset for the form shell', () => {
    render(<ConnectDomainScreen />);

    expect(screen.getByLabelText('connect-domain-form')).toBeInTheDocument();
    expect(mocks.formScreenProps.keyboardOffsetPreset).toBe('compactHeader');
  });

  it('renders the domain field and submit action', () => {
    render(<ConnectDomainScreen />);

    expect(screen.getByText('Connect Existing Domain')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Connect Domain')).toBeInTheDocument();
  });

  it('renders an upgrade gate for free merchants', () => {
    mocks.subscription.isPro = false;
    mocks.subscription.merchant = {
      plan_tier: 'free',
      premium_features: [],
    };

    render(<ConnectDomainScreen />);

    expect(
      screen.getByText('Custom domains are a Baci Pro feature')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Connect Existing Domain')
    ).not.toBeInTheDocument();
  });

  it('shows a fallback error alert when the network request throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network unavailable'));

    render(<ConnectDomainScreen />);

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'shop.example.com' },
    });
    fireEvent.click(screen.getByText('Connect Domain'));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Network unavailable');
    });
  });

  it('posts to the /api/domains endpoint (not the bare page route that 405s)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          domain: { domain: 'shop.example.com' },
          verification: { value: 'txt-token' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<ConnectDomainScreen />);

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'shop.example.com' },
    });
    fireEvent.click(screen.getByText('Connect Domain'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://usebaci.com/api/domains',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('routes to the subscribe screen when the server plan-gates the domain (402)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'requires_upgrade',
          error: 'Custom domains require Baci Starter or higher',
        }),
        { status: 402, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<ConnectDomainScreen />);

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'shop.example.com' },
    });
    fireEvent.click(screen.getByText('Connect Domain'));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Upgrade required',
        expect.stringContaining('Baci Starter'),
        expect.any(Array)
      );
    });

    const alertButtons = mocks.alert.mock.calls.at(-1)?.[2] as Array<{
      onPress?: () => void;
      text: string;
    }>;
    alertButtons.find((button) => button.text === 'Upgrade')?.onPress?.();
    expect(mocks.router.push).toHaveBeenCalledWith('/(admin)/subscribe');
  });
});
