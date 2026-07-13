import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import BuyDomainScreen from './buy';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getSession: vi.fn(),
  performDomainSearch: vi.fn(),
  push: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    ListEmptyComponent,
    renderItem,
  }: {
    data?: unknown[] | null;
    ListEmptyComponent?: ReactNode;
    renderItem: (params: { item: unknown }) => ReactNode;
  }) => (
    <div>
      {data && data.length > 0
        ? data.map((item) => (
            <div key={(item as { domain?: string }).domain}>
              {renderItem({ item })}
            </div>
          ))
        : ListEmptyComponent}
    </div>
  ),
}));

vi.mock('expo-web-browser', () => ({
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
  openBrowserAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: mocks.alert },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    onSubmitEditing,
    placeholder,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    onSubmitEditing?: () => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onSubmitEditing?.();
        }
      }}
      placeholder={placeholder}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/components/domains/buy-domain.styles', () => ({
  styles: new Proxy(
    {},
    {
      get: (_target, property) => property,
    }
  ),
}));

vi.mock('@/components/domains/DomainSearchResultCard', () => ({
  DomainSearchResultCard: ({
    domain,
    onBuy,
  }: {
    domain: { available: boolean; domain: string };
    onBuy: () => void;
  }) => (
    <div>
      <span>{domain.domain}</span>
      <span>{domain.available ? 'Available' : 'Unavailable'}</span>
      <button onClick={onBuy} type="button">
        Buy {domain.domain}
      </button>
    </div>
  ),
}));

vi.mock('@/components/domains/perform-domain-search', () => ({
  performDomainSearch: (query: string, context: unknown) =>
    mocks.performDomainSearch(query, context),
}));

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({ children }: { children?: ReactNode }) => (
    <section aria-label="buy-domain-form">{children}</section>
  ),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      card: '#f8fafc',
      primary: '#2563eb',
      text: '#0f172a',
      textSecondary: '#475569',
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

async function renderWithResult() {
  mocks.performDomainSearch.mockImplementationOnce(
    (
      _query: string,
      context: {
        setLastLookupSucceeded: (value: boolean) => void;
        setLoading: (value: boolean) => void;
        setResults: (results: DomainSearchResult[]) => void;
      }
    ) => {
      context.setResults([
        {
          available: true,
          currency: 'NGN',
          domain: 'baci.com',
          popular: true,
          price: 25000,
        },
      ]);
      context.setLastLookupSucceeded(true);
      context.setLoading(false);
    }
  );

  render(<BuyDomainScreen />);
  const input = screen.getByLabelText('Search domain');
  fireEvent.change(input, { target: { value: 'baci.com' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return await screen.findByRole('button', { name: 'Buy baci.com' });
}

describe('BuyDomainScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the domain search field inside the form shell', () => {
    render(<BuyDomainScreen />);

    expect(screen.getByLabelText('buy-domain-form')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Search domain (e.g. mybrand.com)')
    ).toBeTruthy();
  });

  it('validates that searches include a domain suffix', () => {
    render(<BuyDomainScreen />);

    const input = screen.getByLabelText('Search domain');
    fireEvent.change(input, { target: { value: 'mybrand' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Invalid Domain',
      'Please enter a valid domain (e.g. mystore.com)'
    );
    expect(mocks.performDomainSearch).not.toHaveBeenCalled();
  });

  it('renders search results after a successful lookup', async () => {
    mocks.performDomainSearch.mockImplementationOnce(
      (
        _query: string,
        context: {
          setLastLookupSucceeded: (value: boolean) => void;
          setLoading: (value: boolean) => void;
          setResults: (results: DomainSearchResult[]) => void;
        }
      ) => {
        context.setResults([
          {
            available: true,
            currency: 'NGN',
            domain: 'baci.com',
            popular: true,
            price: 25000,
          },
        ]);
        context.setLastLookupSucceeded(true);
        context.setLoading(false);
      }
    );

    render(<BuyDomainScreen />);

    const input = screen.getByLabelText('Search domain');
    fireEvent.change(input, { target: { value: 'baci.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('baci.com')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy baci.com' })).toBeTruthy();
  });

  it('shows the empty state only after a successful lookup with no results', async () => {
    mocks.performDomainSearch.mockImplementationOnce(
      (
        _query: string,
        context: {
          setLastLookupSucceeded: (value: boolean) => void;
          setLoading: (value: boolean) => void;
          setResults: (results: DomainSearchResult[]) => void;
        }
      ) => {
        context.setResults([]);
        context.setLastLookupSucceeded(true);
        context.setLoading(false);
      }
    );

    render(<BuyDomainScreen />);

    const input = screen.getByLabelText('Search domain');
    fireEvent.change(input, { target: { value: 'missing.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('No results found.')).toBeTruthy();
  });

  it('clears results when the search input is cleared', async () => {
    mocks.performDomainSearch.mockImplementationOnce(
      (
        _query: string,
        context: {
          setLastLookupSucceeded: (value: boolean) => void;
          setLoading: (value: boolean) => void;
          setResults: (results: DomainSearchResult[]) => void;
        }
      ) => {
        context.setResults([
          {
            available: true,
            currency: 'NGN',
            domain: 'baci.com',
            popular: true,
            price: 25000,
          },
        ]);
        context.setLastLookupSucceeded(true);
        context.setLoading(false);
      }
    );

    render(<BuyDomainScreen />);

    const input = screen.getByLabelText('Search domain');
    fireEvent.change(input, { target: { value: 'baci.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('baci.com')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear domain search' })
    );

    expect(screen.queryByText('baci.com')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Buy baci.com' })).toBeNull();
  });

  it('routes to the subscribe screen when the purchase is plan-gated (402)', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'requires_upgrade',
          error: 'Custom domains require Baci Starter or higher',
        }),
        { status: 402, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const buyButton = await renderWithResult();
      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(mocks.alert).toHaveBeenCalledWith(
          'Upgrade required',
          expect.stringContaining('Baci Starter'),
          expect.any(Array)
        );
      });

      // The alert's "Upgrade" action must lead to the paywall (payment path).
      const alertButtons = mocks.alert.mock.calls.at(-1)?.[2] as Array<{
        onPress?: () => void;
        text: string;
      }>;
      alertButtons.find((button) => button.text === 'Upgrade')?.onPress?.();
      expect(mocks.push).toHaveBeenCalledWith('/(admin)/subscribe');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows a Purchase Failed alert for genuine payment errors (500)', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'Failed to initialize payment gateway' }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const buyButton = await renderWithResult();
      fireEvent.click(buyButton);

      await waitFor(() => {
        expect(mocks.alert).toHaveBeenCalledWith(
          'Purchase Failed',
          expect.stringContaining('payment gateway')
        );
      });
      expect(mocks.push).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
