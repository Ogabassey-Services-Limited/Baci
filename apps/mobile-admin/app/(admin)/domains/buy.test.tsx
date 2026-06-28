import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BuyDomainScreen from './buy';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  performDomainSearch: vi.fn(),
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
    domain: { domain: string };
    onBuy: () => void;
  }) => (
    <button onClick={onBuy} type="button">
      Buy {domain.domain}
    </button>
  ),
}));

vi.mock('@/components/domains/perform-domain-search', () => ({
  performDomainSearch: mocks.performDomainSearch,
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
      getSession: vi.fn(),
    },
  },
}));

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
});
