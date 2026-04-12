import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscountItemSelector } from './DiscountItemSelector';

const mocks = vi.hoisted(() => ({
  fetchSelectableItems: vi.fn(),
}));

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    onClose,
    title,
    trailingAccessory,
    visible,
  }: {
    children?: ReactNode;
    closeLabel?: string;
    onClose: () => void;
    title: string;
    trailingAccessory?: ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="discount-item-page-sheet">
        <button
          aria-label={closeLabel ?? 'Close sheet'}
          onClick={onClose}
          type="button"
        >
          close
        </button>
        <h1>{title}</h1>
        <div>{trailingAccessory}</div>
        {children}
      </section>
    ) : null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      backgroundLight: '#f8fafc',
      border: '#d1d5db',
      card: '#f8fafc',
      error: '#dc2626',
      errorLight: '#fee2e2',
      inputBg: '#e2e8f0',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#475569',
    },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1' },
  }),
}));

vi.mock('@/lib/discount-items', () => ({
  fetchSelectableItems: mocks.fetchSelectableItems,
}));

vi.mock('@/lib/sanitize', () => ({
  stripHtmlTags: (value: string) => value,
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => <div>image</div>,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <div>loading</div>,
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ id: string; name: string }>;
    renderItem: (item: { item: { id: string; name: string } }) => ReactNode;
  }) => <div>{data.map((item) => renderItem({ item }))}</div>,
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    onSubmitEditing,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
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
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('DiscountItemSelector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    mocks.fetchSelectableItems.mockResolvedValue([]);
  });

  it('renders an error message when loading selectable items fails', async () => {
    mocks.fetchSelectableItems.mockRejectedValueOnce(new Error('boom'));

    render(
      <DiscountItemSelector
        initialIds={[]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        type="product"
        visible={true}
      />
    );

    expect(await screen.findByText('Failed to load items')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Laptop' })
    ).not.toBeInTheDocument();
  });

  it('renders through the shared page-sheet shell and saves selections', async () => {
    mocks.fetchSelectableItems.mockResolvedValue([
      { description: 'Phone', id: 'product-1', images: [], name: 'Phone' },
      { description: 'Laptop', id: 'product-2', images: [], name: 'Laptop' },
    ]);

    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <DiscountItemSelector
        initialIds={['product-1']}
        onClose={onClose}
        onSelect={onSelect}
        type="product"
        visible={true}
      />
    );

    expect(
      screen.getByLabelText('discount-item-page-sheet')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Laptop' })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Laptop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onSelect).toHaveBeenCalledWith(['product-1', 'product-2']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when hidden', () => {
    render(
      <DiscountItemSelector
        initialIds={[]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        type="category"
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('discount-item-page-sheet')
    ).not.toBeInTheDocument();
  });
});
