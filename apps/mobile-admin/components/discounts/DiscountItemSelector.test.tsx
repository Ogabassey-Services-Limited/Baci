import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscountItemSelector } from './DiscountItemSelector';

const mocks = vi.hoisted(() => ({
  fetchSelectableItems: vi.fn(),
  keyboardContainerProps: {
    align: undefined as 'start' | 'center' | 'end' | undefined,
    scrollEnabled: undefined as boolean | undefined,
  },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1' },
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      backgroundLight: '#f8fafc',
      border: '#e2e8f0',
      error: '#dc2626',
      errorLight: '#fee2e2',
      inputBg: '#f1f5f9',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#64748b',
    },
  }),
}));

vi.mock('@/lib/discount-items', () => ({
  fetchSelectableItems: mocks.fetchSelectableItems,
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => <span>image</span>,
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({
    align,
    children,
    scrollEnabled,
  }: {
    align?: 'start' | 'center' | 'end';
    children?: ReactNode;
    scrollEnabled?: boolean;
  }) => {
    mocks.keyboardContainerProps.align = align;
    mocks.keyboardContainerProps.scrollEnabled = scrollEnabled;
    return <section aria-label="discount-keyboard-container">{children}</section>;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ id: string; name: string }>;
    renderItem: (props: { item: { id: string; name: string } }) => ReactNode;
  }) => <div>{data.map((item) => renderItem({ item }))}</div>,
  Modal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible?: boolean;
  }) => (visible ? <div>{children}</div> : null),
  Platform: { OS: 'ios' },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  SafeAreaView: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
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

describe('DiscountItemSelector', () => {
  beforeEach(() => {
    mocks.fetchSelectableItems.mockReset();
    mocks.fetchSelectableItems.mockResolvedValue([
      {
        id: 'product-1',
        name: 'First Product',
        images: [],
      },
    ]);
    mocks.keyboardContainerProps.align = undefined;
    mocks.keyboardContainerProps.scrollEnabled = undefined;
  });

  it('renders search and done controls', async () => {
    render(
      <DiscountItemSelector
        initialIds={[]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        type="product"
        visible={true}
      />
    );

    expect(screen.getByLabelText('Done')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('First Product')).toBeInTheDocument();
    });
  });

  it('uses the shared keyboard container with non-scroll shell settings', () => {
    render(
      <DiscountItemSelector
        initialIds={[]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        type="category"
        visible={true}
      />
    );

    expect(
      screen.getByLabelText('discount-keyboard-container')
    ).toBeInTheDocument();
    expect(mocks.keyboardContainerProps.align).toBe('start');
    expect(mocks.keyboardContainerProps.scrollEnabled).toBe(false);
  });
});
