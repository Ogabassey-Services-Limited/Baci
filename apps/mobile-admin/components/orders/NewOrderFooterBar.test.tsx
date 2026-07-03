import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderFooterBar } from './NewOrderFooterBar';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  const flattenStyle = (value: unknown): Record<string, unknown> => {
    if (Array.isArray(value)) {
      return Object.assign({}, ...value.filter(Boolean).map(flattenStyle));
    }
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    return {};
  };

  return {
    ActivityIndicator: () =>
      React.createElement(
        'span',
        { 'aria-hidden': 'true', className: 'activity-indicator' },
        'Loading...'
      ),
    StatusBar: () => null,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
      style,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: {
        busy?: boolean;
        checked?: boolean;
        disabled?: boolean;
      };
      accessibilityRole?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      style?: ((state: { pressed: boolean }) => unknown) | unknown;
    }) => {
      const resolvedStyle = flattenStyle(
        typeof style === 'function' ? style({ pressed: false }) : style
      );

      return React.createElement(
        'button',
        {
          'aria-busy': accessibilityState?.busy ? 'true' : undefined,
          'aria-checked': accessibilityState?.checked ? 'true' : undefined,
          'aria-label': accessibilityLabel,
          'data-shadow-color': resolvedStyle.shadowColor,
          disabled: disabled || accessibilityState?.disabled,
          onClick: () => onPress?.(),
          role: accessibilityRole,
          type: 'button',
        },
        children
      );
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityState,
      editable,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityState?: { disabled?: boolean };
      editable?: boolean;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': placeholder,
        disabled: editable === false || accessibilityState?.disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      style,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      style?: Record<string, unknown> | Record<string, unknown>[];
      testID?: string;
    }) => {
      const flattenedStyle = flattenStyle(style);

      return React.createElement(
        'div',
        {
          'aria-label': accessibilityLabel,
          'data-padding-bottom': String(flattenedStyle.paddingBottom ?? ''),
          'data-testid': testID,
          role: accessibilityRole,
        },
        children
      );
    },
  };
});

vi.mock('./new-order.styles', () => ({
  NEW_ORDER_FOOTER_BASE_PADDING_BOTTOM: 20,
  styles: {},
}));

type FooterController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'shadows'
  | 'formatPrice'
  | 'handleSubmit'
  | 'isSubmitting'
  | 'orderItems'
  | 'partialAmount'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'setPartialAmount'
  | 'setPaymentMethod'
  | 'setPaymentStatus'
  | 'total'
>;

function makeController(
  overrides: Partial<FooterController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      background: '#f8fafc',
      border: '#e2e8f0',
      card: '#ffffff',
      error: '#dc2626',
      inputBg: '#f1f5f9',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#64748b',
      warning: '#d97706',
    },
    shadows: {
      lg: { shadowColor: '#334155' },
      md: { shadowColor: '#64748b' },
      sm: { shadowColor: '#94a3b8' },
    },
    formatPrice: (amount: number) => `₦${amount.toFixed(2)}`,
    handleSubmit: vi.fn(),
    isSubmitting: false,
    orderItems: [
      {
        id: 'item-1',
        name: 'Baci Phone',
        price: 2000,
        product_id: 'product-1',
        quantity: 1,
        variant_id: null,
        variant_name: null,
      },
    ],
    partialAmount: '',
    paymentMethod: 'transfer',
    paymentStatus: 'unpaid',
    setPartialAmount: vi.fn(),
    setPaymentMethod: vi.fn(),
    setPaymentStatus: vi.fn(),
    total: 5000,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderFooterBar', () => {
  it('extends the card background through the bottom safe area', () => {
    const controller = makeController();

    render(<NewOrderFooterBar controller={controller} />);

    expect(screen.getByTestId('new-order-footer-bar')).toHaveAttribute(
      'data-padding-bottom',
      '32'
    );
  });

  it('shows payment status choices with unpaid first and clear radio affordance', () => {
    const controller = makeController();

    render(<NewOrderFooterBar controller={controller} />);

    expect(screen.getByText('Payment Status')).toBeInTheDocument();

    const statusOptions = screen.getAllByRole('radio');
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(statusOptions).toHaveLength(3);
    expect(statusOptions.map((option) => option.textContent)).toEqual([
      'UNPAID',
      'PAID',
      'Partial',
    ]);
    expect(statusOptions[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('disables save when there are no order items and shows the formatted total', () => {
    const controller = makeController({ orderItems: [] });

    render(<NewOrderFooterBar controller={controller} />);

    expect(screen.getByText('Total Amount')).toBeInTheDocument();
    expect(screen.getByText('₦5000.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Order' })).toBeDisabled();
  });

  it('uses the themed shadow token for the selected payment status', () => {
    const controller = makeController({
      paymentStatus: 'paid',
      shadows: {
        ...makeController().shadows,
        sm: { ...makeController().shadows.sm, shadowColor: '#123456' },
      },
    });

    render(<NewOrderFooterBar controller={controller} />);

    expect(
      screen.getByRole('radio', { name: 'Payment status: PAID' })
    ).toHaveAttribute('data-shadow-color', '#123456');
  });

  it('shows partial-payment controls and forwards payment method and amount changes', () => {
    const controller = makeController({
      partialAmount: '4000',
      paymentStatus: 'partially_paid',
    });

    render(<NewOrderFooterBar controller={controller} />);

    expect(
      screen.getByRole('radiogroup', { name: 'Payment method' })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('radio', { name: 'Payment method: Cash' })
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Enter amount...' }), {
      target: { value: '4250' },
    });

    expect(controller.setPaymentMethod).toHaveBeenCalledWith('cash');
    expect(controller.setPartialAmount).toHaveBeenCalledWith('4250');
  });

  it('resets partial amount when switching away from partial payments and submits when enabled', () => {
    const controller = makeController({
      partialAmount: '3500',
      paymentStatus: 'partially_paid',
    });

    render(<NewOrderFooterBar controller={controller} />);

    fireEvent.click(
      screen.getByRole('radio', { name: 'Payment status: UNPAID' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Order' }));

    expect(controller.setPaymentStatus).toHaveBeenCalledWith('unpaid');
    expect(controller.setPartialAmount).toHaveBeenCalledWith('');
    expect(controller.handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows saving state and disables interactions when isSubmitting is true', () => {
    const controller = makeController({
      isSubmitting: true,
      partialAmount: '4000',
      paymentStatus: 'partially_paid',
    });
    render(<NewOrderFooterBar controller={controller} />);

    const saveButton = screen.getByRole('button', { name: 'Saving order' });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument(); // matches ActivityIndicator mock
    expect(
      screen.getByRole('radio', { name: 'Payment status: PAID' })
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: 'Payment method: Cash' })
    ).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Enter amount...' })
    ).toBeDisabled();
  });
});
