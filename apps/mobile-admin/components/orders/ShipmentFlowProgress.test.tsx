import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { COLORS } from '@/constants/theme';
import { ShipmentFlowProgress } from './ShipmentFlowProgress';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({
    accessibilityLabel,
    children,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
  }) => <section aria-label={accessibilityLabel}>{children}</section>,
}));

describe('ShipmentFlowProgress', () => {
  it('renders each step while the flow has only a few steps', () => {
    render(
      <ShipmentFlowProgress
        colors={COLORS}
        currentStepIndex={1}
        steps={[
          { id: 'details', label: 'Details' },
          { id: 'shipping', label: 'Shipping' },
          { id: 'dispatch', label: 'Dispatch' },
        ]}
      />
    );

    expect(screen.getByLabelText(/Step 2: Shipping/)).toBeInTheDocument();
    expect(screen.getByText('Dispatch')).toBeInTheDocument();
  });

  it('renders each step at the compact-mode threshold', () => {
    render(
      <ShipmentFlowProgress
        colors={COLORS}
        currentStepIndex={0}
        steps={[
          { id: 'item-1', label: 'Item 1' },
          { id: 'item-2', label: 'Item 2' },
          { id: 'item-3', label: 'Item 3' },
          { id: 'item-4', label: 'Item 4' },
        ]}
      />
    );

    expect(screen.getByText('Item 4')).toBeInTheDocument();
    expect(screen.queryByText(/Step 1 of 4/)).not.toBeInTheDocument();
  });

  it('uses a compact counter for many item-level fulfillment steps', () => {
    render(
      <ShipmentFlowProgress
        colors={COLORS}
        currentStepIndex={3}
        steps={[
          { id: 'item-1', label: 'Item 1' },
          { id: 'item-2', label: 'Item 2' },
          { id: 'item-3', label: 'Item 3' },
          { id: 'item-4', label: 'Item 4' },
          { id: 'shipping', label: 'Shipping' },
          { id: 'dispatch', label: 'Dispatch' },
        ]}
      />
    );

    expect(screen.getByLabelText(/Step 4 of 6: Item 4/)).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 6')).toBeInTheDocument();
    expect(screen.queryByText('Dispatch')).not.toBeInTheDocument();
  });
});
