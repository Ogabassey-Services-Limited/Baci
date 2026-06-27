import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useEditOrderController } from '@/hooks/useEditOrderController';
import { EditOrderFooterBar } from './EditOrderFooterBar';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean; disabled?: boolean };
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-disabled': disabled || accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => {
            if (!(disabled || accessibilityState?.disabled)) {
              onPress?.();
            }
          },
          role: accessibilityRole,
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

function createController(
  overrides: Partial<ReturnType<typeof useEditOrderController>> = {}
): ReturnType<typeof useEditOrderController> {
  return {
    colors: {
      border: '#e2e8f0',
      card: '#ffffff',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#64748b',
      warning: '#d97706',
    },
    formatPrice: (amount: number) => `₦${amount}`,
    handleSubmit: vi.fn(),
    isFinancialLocked: false,
    isSubmitting: false,
    notifyCustomer: false,
    orderItems: [{ id: 'item-1' }],
    setNotifyCustomer: vi.fn(),
    total: 1000,
    ...overrides,
  } as unknown as ReturnType<typeof useEditOrderController>;
}

describe('EditOrderFooterBar', () => {
  it('toggles notification preference and saves changes', () => {
    const controller = createController();

    render(<EditOrderFooterBar controller={controller} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Notify customer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(controller.setNotifyCustomer).toHaveBeenCalledWith(true);
    expect(controller.handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables saving while submitting', () => {
    render(
      <EditOrderFooterBar
        controller={createController({ isSubmitting: true })}
      />
    );

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  it('disables saving when there are no order items', () => {
    render(
      <EditOrderFooterBar controller={createController({ orderItems: [] })} />
    );

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  it('freezes the notify switch while submitting', () => {
    const controller = createController({ isSubmitting: true });

    render(<EditOrderFooterBar controller={controller} />);

    const notifySwitch = screen.getByRole('switch', {
      name: 'Notify customer',
    });
    fireEvent.click(notifySwitch);

    expect(notifySwitch).toBeDisabled();
    expect(controller.setNotifyCustomer).not.toHaveBeenCalled();
  });
});
