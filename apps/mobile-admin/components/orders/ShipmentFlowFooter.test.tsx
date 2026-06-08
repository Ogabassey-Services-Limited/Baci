import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { ShipmentFlowFooter } from './ShipmentFlowFooter';

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
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
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

const baseProps = {
  colors: LIGHT_COLORS,
  primaryActionLabel: 'Continue',
  selectedMode: 'self_fulfillment',
  showBack: true,
  step: 'details',
} as const;

describe('ShipmentFlowFooter', () => {
  it('marks footer actions disabled and busy while a shipment is submitting', () => {
    const onBack = vi.fn();
    const onPrimaryAction = vi.fn();

    render(
      <ShipmentFlowFooter
        {...baseProps}
        isSubmitting={true}
        onBack={onBack}
        onPrimaryAction={onPrimaryAction}
      />
    );

    const backButton = screen.getByRole('button', { name: 'Back' });
    const primaryButton = screen.getByRole('button', { name: 'Continue' });

    expect(backButton).toBeDisabled();
    expect(backButton).toHaveAttribute('aria-busy', 'true');
    expect(primaryButton).toBeDisabled();
    expect(primaryButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('activity-indicator')).toBeInTheDocument();

    fireEvent.click(backButton);
    fireEvent.click(primaryButton);

    expect(onBack).not.toHaveBeenCalled();
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });

  it('keeps footer actions operable and not busy when idle', () => {
    const onBack = vi.fn();
    const onPrimaryAction = vi.fn();

    render(
      <ShipmentFlowFooter
        {...baseProps}
        isSubmitting={false}
        onBack={onBack}
        onPrimaryAction={onPrimaryAction}
      />
    );

    const backButton = screen.getByRole('button', { name: 'Back' });
    const primaryButton = screen.getByRole('button', { name: 'Continue' });

    expect(backButton).not.toBeDisabled();
    expect(backButton).not.toHaveAttribute('aria-busy');
    expect(primaryButton).not.toBeDisabled();
    expect(primaryButton).not.toHaveAttribute('aria-busy');

    fireEvent.click(backButton);
    fireEvent.click(primaryButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
