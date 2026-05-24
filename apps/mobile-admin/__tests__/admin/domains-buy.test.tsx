import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainSearchResult } from '@/components/domains/domain-search-result';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getSession: vi.fn(),
  openBrowserAsync: vi.fn(),
}));

function getFlashListItemKey(item: DomainSearchResult): string {
  return item.domain;
}

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      onSubmitEditing,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      onSubmitEditing?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            onSubmitEditing?.();
          }
        },
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    ListEmptyComponent,
    renderItem,
  }: {
    data: DomainSearchResult[];
    ListEmptyComponent?: ReactNode;
    renderItem: ({ item }: { item: DomainSearchResult }) => ReactNode;
  }) => (
    <div>
      {data.length === 0 ? ListEmptyComponent : null}
      {data.map((item) => (
        <div key={getFlashListItemKey(item)}>{renderItem({ item })}</div>
      ))}
    </div>
  ),
}));

vi.mock('expo-web-browser', () => ({
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
  openBrowserAsync: mocks.openBrowserAsync,
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      success: '#16a34a',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
      textSecondary: '#94a3b8',
    },
    shadows: {
      sm: {},
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

const fetchMock = vi.fn();

import BuyDomainScreen from '@/app/(admin)/domains/buy';

describe('BuyDomainScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            available: true,
            domain: 'baci.com',
            popular: true,
            price: 25000,
          },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the screen inside the shared form shell', () => {
    render(<BuyDomainScreen />);

    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search domain (e.g. mybrand.com)')
    ).toBeInTheDocument();
  });

  it('shows a validation alert when the search term is not a domain', () => {
    render(<BuyDomainScreen />);

    const input = screen.getByPlaceholderText(
      'Search domain (e.g. mybrand.com)'
    );
    fireEvent.change(input, { target: { value: 'mybrand' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Invalid Domain',
      'Please enter a valid domain (e.g. mystore.com)'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders search results after a successful lookup', async () => {
    render(<BuyDomainScreen />);

    const input = screen.getByPlaceholderText(
      'Search domain (e.g. mybrand.com)'
    );
    fireEvent.change(input, { target: { value: 'baci.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.getByText('baci.com')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Buy baci.com' })
    ).toBeInTheDocument();
  });

  it('shows the empty state only after a successful lookup with no results', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    render(<BuyDomainScreen />);

    const input = screen.getByPlaceholderText(
      'Search domain (e.g. mybrand.com)'
    );
    fireEvent.change(input, { target: { value: 'missing.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('clears results and ignores stale responses when the search input is cleared', async () => {
    type LookupResponse = {
      json: () => Promise<{
        results: DomainSearchResult[];
      }>;
      ok: boolean;
    };

    let resolveLookup: ((value: LookupResponse) => void) | undefined;

    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        })
    );

    render(<BuyDomainScreen />);

    const input = screen.getByPlaceholderText(
      'Search domain (e.g. mybrand.com)'
    );
    fireEvent.change(input, { target: { value: 'baci.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear domain search' })
    );

    if (!resolveLookup) {
      throw new Error('Lookup resolver was not set');
    }

    resolveLookup({
      ok: true,
      json: async () => ({
        results: [
          {
            available: true,
            currency: 'NGN',
            domain: 'baci.com',
            popular: true,
            price: 25000,
          },
        ],
      }),
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Clear domain search' })
      ).not.toBeInTheDocument();
    });

    expect(screen.queryByText('baci.com')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Buy baci.com' })
    ).not.toBeInTheDocument();
  });

  it('shows an error alert when the lookup fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Lookup failed' }),
    });

    render(<BuyDomainScreen />);

    const input = screen.getByPlaceholderText(
      'Search domain (e.g. mybrand.com)'
    );
    fireEvent.change(input, { target: { value: 'baci.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(mocks.alert).toHaveBeenCalledWith('Search Failed', 'Lookup failed');
    expect(screen.queryByText('No results found.')).not.toBeInTheDocument();
  });
});
