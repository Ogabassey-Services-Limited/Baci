import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    accessibilityState,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityState?: { selected?: boolean };
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      aria-pressed={accessibilityState?.selected ?? false}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

import { RepairStatusFilterChips } from './RepairStatusFilterChips';

const colors = {
  card: '#FFFFFF',
  gold: '#F0BF58',
  textOnGold: '#111827',
  textSecondary: '#9CA3AF',
} as unknown as Parameters<typeof RepairStatusFilterChips>[0]['colors'];

describe('RepairStatusFilterChips', () => {
  it('renders an "All" chip plus every repair status', () => {
    render(
      <RepairStatusFilterChips colors={colors} onSelect={vi.fn()} selected="all" />
    );

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('marks the currently selected filter', () => {
    render(
      <RepairStatusFilterChips
        colors={colors}
        onSelect={vi.fn()}
        selected="confirmed"
      />
    );

    expect(
      screen.getByRole('button', { name: 'Confirmed' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('calls onSelect with the tapped status', () => {
    const onSelect = vi.fn();
    render(
      <RepairStatusFilterChips colors={colors} onSelect={onSelect} selected="all" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'In progress' }));

    expect(onSelect).toHaveBeenCalledWith('in_progress');
  });
});
