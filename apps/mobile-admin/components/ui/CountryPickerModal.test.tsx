import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';

// Captured Pressable props per test. Declared with `vi.hoisted` because
// `vi.mock` factories run before plain top-level `const` declarations and
// would otherwise hit a TDZ ReferenceError.
const { pressablePropCalls } = vi.hoisted(() => ({
  pressablePropCalls: [] as Array<{
    accessibilityLabel?: string;
    hitSlop?: unknown;
  }>,
}));

vi.mock('@/constants/countries', () => ({
  COUNTRIES: [
    {
      code: 'NG',
      currency: 'NGN',
      currencySymbol: '₦',
      name: 'Nigeria',
    },
    {
      code: 'GH',
      currency: 'GHS',
      currencySymbol: '₵',
      name: 'Ghana',
    },
    {
      code: 'KE',
      currency: 'KES',
      currencySymbol: 'KSh',
      name: 'Kenya',
    },
  ],
}));

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    onClose,
    title,
    visible,
  }: {
    children?: ReactNode;
    closeLabel?: string;
    onClose: () => void;
    title: string;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="country-page-sheet">
        <button
          aria-label={closeLabel ?? 'Close sheet'}
          onClick={onClose}
          type="button"
        >
          close
        </button>
        <h1>{title}</h1>
        {children}
      </section>
    ) : null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#d1d5db',
      card: '#f8fafc',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#475569',
    },
  }),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    hitSlop,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    hitSlop?: unknown;
    onPress?: () => void;
  }) => {
    pressablePropCalls.push({ accessibilityLabel, hitSlop });
    return (
      <button aria-label={accessibilityLabel} onClick={onPress} type="button">
        {children}
      </button>
    );
  },
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('CountryPickerModal', () => {
  beforeEach(() => {
    pressablePropCalls.length = 0;
  });

  it('renders through the shared page-sheet shell and routes close/select actions', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <CountryPickerModal
        onClose={onClose}
        onSelect={onSelect}
        selectedCountry="NG"
        visible={true}
      />
    );

    expect(screen.getByLabelText('country-page-sheet')).toBeInTheDocument();
    expect(screen.getByText('Select Country')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nigeria' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghana' })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close country picker' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ghana' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith({
        code: 'GH',
        currency: 'GHS',
        currencySymbol: '₵',
        name: 'Ghana',
      });
    });
  }, 15_000);

  it('filters the country list from the search input and clears it again', () => {
    render(
      <CountryPickerModal
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedCountry=""
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Search countries'), {
      target: { value: 'gha' },
    });

    expect(screen.getByRole('button', { name: 'Ghana' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nigeria' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Kenya' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByRole('button', { name: 'Nigeria' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kenya' })).toBeInTheDocument();
  });

  it('gives the clear-search button a 13pt hitSlop so the effective tap area meets 44pt', () => {
    render(
      <CountryPickerModal
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedCountry=""
        visible={true}
      />
    );

    // The clear button is rendered conditionally once the search input has
    // text, so type something to make it visible.
    fireEvent.change(screen.getByLabelText('Search countries'), {
      target: { value: 'gha' },
    });

    const clearCall = pressablePropCalls.find(
      (call) => call.accessibilityLabel === 'Clear search'
    );
    expect(clearCall).toBeDefined();
    // Pinned: the icon is 18pt and the WCAG/HIG minimum target is 44pt, so
    // hitSlop must be at least 13 on each side (18 + 13 + 13 = 44). Lower
    // values would re-introduce the touch-target regression this PR fixes.
    expect(clearCall?.hitSlop).toBe(13);
  });

  it('does not render when hidden', () => {
    render(
      <CountryPickerModal
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedCountry=""
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('country-page-sheet')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nigeria' })
    ).not.toBeInTheDocument();
  });
});
