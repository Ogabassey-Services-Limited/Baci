import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StaffSummaryCards } from './StaffSummaryCards';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>,
}));

describe('StaffSummaryCards', () => {
  it('renders staff totals', () => {
    render(
      <StaffSummaryCards
        colors={LIGHT_COLORS}
        shadowStyle={SHADOWS.sm}
        stats={{ active: 4, pending: 2, total: 6 }}
      />
    );

    const totalCard = screen.getByTestId('total-card');
    const activeCard = screen.getByTestId('active-card');
    const pendingCard = screen.getByTestId('pending-card');

    expect(within(totalCard).getByText('6')).toBeInTheDocument();
    expect(within(totalCard).getByText('Total')).toBeInTheDocument();
    expect(within(activeCard).getByText('4')).toBeInTheDocument();
    expect(within(activeCard).getByText('Active')).toBeInTheDocument();
    expect(within(pendingCard).getByText('2')).toBeInTheDocument();
    expect(within(pendingCard).getByText('Pending')).toBeInTheDocument();
  });

  it('renders zero values without collapsing the cards', () => {
    render(
      <StaffSummaryCards
        colors={LIGHT_COLORS}
        shadowStyle={SHADOWS.sm}
        stats={{ active: 0, pending: 0, total: 0 }}
      />
    );

    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
