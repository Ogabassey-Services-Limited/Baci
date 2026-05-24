import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import {
  OrderItemDetailModal,
  type OrderItemSnapshot,
} from './OrderItemDetailModal';

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    accessibilityLabel,
    children,
    visible,
  }: {
    accessibilityLabel: string;
    children?: ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label={accessibilityLabel}>{children}</section>
    ) : null,
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { color?: string; name: string; size?: number }) => name,

  default: ({ name }: { color?: string; name: string; size?: number }) => name,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: ({ source }: { source?: { uri?: string } }) => source?.uri ?? null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: LIGHT_COLORS,
  }),
}));

vi.mock('react-native', () => {
  return {
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
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

function createItem(
  overrides: Partial<OrderItemSnapshot> = {}
): OrderItemSnapshot {
  return {
    id: 'item-1',
    condition: 'open_box',
    image_url: 'https://example.com/s22.png',
    name: 'Samsung Galaxy S22 Ultra',
    price: 500000,
    product_id: '1e3a022f-608c-45c4-8afa-b29e6c673b8b',
    quantity: 1,
    variant_name: '128GB / Phantom Black',
    ...overrides,
  };
}

describe('OrderItemDetailModal', () => {
  it('renders the order snapshot details through the shared sheet shell', () => {
    render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={vi.fn()}
        visible
      />
    );

    expect(
      screen.getByRole('region', { name: 'Order item details' })
    ).toBeInTheDocument();
    expect(screen.getByText('Item Details')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This is the order snapshot the customer actually bought.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Samsung Galaxy S22 Ultra')).toBeInTheDocument();
    expect(screen.getByText('128GB / Phantom Black')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Unit price')).toBeInTheDocument();
    expect(screen.getByText('Line total')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Open Box')).toBeInTheDocument();
    expect(screen.queryByText('Edit Product')).not.toBeInTheDocument();
  });

  it('closes when the user presses the close control', () => {
    const onClose = vi.fn();

    render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={onClose}
        visible
      />
    );

    fireEvent.click(screen.getByLabelText('Close item details'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes accessible button controls for both dismissal actions', () => {
    render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={vi.fn()}
        visible
      />
    );

    expect(
      screen.getByRole('button', { name: 'Close item details' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close item detail sheet' })
    ).toBeInTheDocument();
  });

  it('does not render when hidden or when no item is available', () => {
    const { rerender } = render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={vi.fn()}
        visible={false}
      />
    );

    expect(
      screen.queryByRole('region', { name: 'Order item details' })
    ).not.toBeInTheDocument();

    rerender(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={null}
        onClose={vi.fn()}
        visible={true}
      />
    );

    expect(
      screen.queryByRole('region', { name: 'Order item details' })
    ).not.toBeInTheDocument();
  });
});
