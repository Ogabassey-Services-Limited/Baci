import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseCategorySheet } from './ExpenseCategorySheet';

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    accessibilityLabel,
    children,
    visible,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    visible?: boolean;
  }) =>
    visible ? (
      <section aria-label={accessibilityLabel ?? 'expense-category-sheet'}>
        {children}
      </section>
    ) : null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#d1d5db',
      primary: '#2563eb',
      text: '#111827',
    },
  }),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => <span>icon</span>,

  default: () => <span>icon</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
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
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('ExpenseCategorySheet', () => {
  it('renders categories and closes after selecting one', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <ExpenseCategorySheet
        onClose={onClose}
        onSelect={onSelect}
        selectedCategory="Marketing"
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Select Inventory expense category',
      })
    );

    expect(onSelect).toHaveBeenCalledWith('Inventory');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when hidden', () => {
    render(
      <ExpenseCategorySheet
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedCategory="Marketing"
        visible={false}
      />
    );

    expect(
      screen.queryByRole('region', { name: 'Expense category sheet' })
    ).not.toBeInTheDocument();
  });
});
