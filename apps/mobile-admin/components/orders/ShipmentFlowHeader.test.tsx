import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { ShipmentFlowHeader } from './ShipmentFlowHeader';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  type PressableProps = {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { busy?: boolean; disabled?: boolean };
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  };

  return {
    StyleSheet: {
      absoluteFill: {},
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: PressableProps) =>
      ReactModule.createElement(
        'button',
        {
          'aria-busy': accessibilityState?.busy || undefined,
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => {
            if (!disabled) {
              onPress?.();
            }
          },
          role: accessibilityRole,
          type: 'button',
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('div', null, children),
  };
});

describe('ShipmentFlowHeader', () => {
  it('marks the close button disabled and busy while a shipment is submitting', () => {
    const onClose = vi.fn();

    render(
      <ShipmentFlowHeader
        colors={LIGHT_COLORS}
        isSubmitting={true}
        onClose={onClose}
        orderNumber="ORD-42"
        step="details"
      />
    );

    expect(screen.getByText('Ship ORD-42')).toBeInTheDocument();
    expect(screen.getByText('Fulfillment Details')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', {
      name: 'Close shipment flow',
    });

    expect(closeButton).toBeDisabled();
    expect(closeButton).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(closeButton);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the close button operable and not busy when idle', () => {
    const onClose = vi.fn();

    render(
      <ShipmentFlowHeader
        colors={LIGHT_COLORS}
        isSubmitting={false}
        onClose={onClose}
        orderNumber="ORD-42"
        step="method"
      />
    );

    expect(screen.getByText('Choose Shipping Method')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', {
      name: 'Close shipment flow',
    });

    expect(closeButton).not.toBeDisabled();
    expect(closeButton).not.toHaveAttribute('aria-busy');

    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
