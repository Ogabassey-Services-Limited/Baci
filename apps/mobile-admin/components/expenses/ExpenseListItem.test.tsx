import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense } from '@/schemas/expense';
import { ExpenseListItem } from './ExpenseListItem';

const mocks = vi.hoisted(() => ({
  formatCurrency: vi.fn(
    (_amount: number, _locale?: string, _currency?: string) => 'NGN 12,500.00'
  ),
  router: { push: vi.fn() },
}));

vi.mock('expo-router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#cbd5e1',
    },
  }),
}));

vi.mock('@/lib/utils', () => ({
  formatCurrency: (amount: number, locale?: string, currency?: string) =>
    mocks.formatCurrency(amount, locale, currency),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  amount: 12_500,
  branch_id: 'branch-1',
  category: 'Inventory',
  date: '2026-05-05T00:00:00.000Z',
  description: 'Office internet',
  id: 'expense-1',
  receipt_url: null,
  ...overrides,
});

describe('ExpenseListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formatCurrency.mockReturnValue('NGN 12,500.00');
  });

  it('opens the expense detail screen when pressed', () => {
    render(
      <ExpenseListItem item={expense()} merchant={{ payout_currency: 'NGN' }} />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open expense Inventory: Office internet',
      })
    );

    expect(mocks.router.push).toHaveBeenCalledWith('/expenses/expense-1');
  });

  it('uses accessible labels with and without descriptions', () => {
    const { rerender } = render(<ExpenseListItem item={expense()} />);

    expect(
      screen.getByRole('button', {
        name: 'Open expense Inventory: Office internet',
      })
    ).toBeInTheDocument();

    rerender(<ExpenseListItem item={expense({ description: null })} />);

    expect(
      screen.getByRole('button', { name: 'Open expense Inventory' })
    ).toBeInTheDocument();
  });

  it('renders invalid dates explicitly', () => {
    render(<ExpenseListItem item={expense({ date: 'not-a-date' })} />);

    expect(screen.getByText('Invalid date')).toBeInTheDocument();
  });

  it('shows the receipt icon only when a receipt is attached', () => {
    const { rerender } = render(<ExpenseListItem item={expense()} />);

    expect(
      document.querySelector('[data-icon="document-attach-outline"]')
    ).not.toBeInTheDocument();

    rerender(
      <ExpenseListItem
        item={expense({ receipt_url: 'https://example.com/receipt.jpg' })}
      />
    );

    expect(
      document.querySelector('[data-icon="document-attach-outline"]')
    ).toBeInTheDocument();
  });

  it('formats amounts with the merchant currency or NGN fallback', () => {
    const { rerender } = render(
      <ExpenseListItem item={expense()} merchant={{ payout_currency: 'USD' }} />
    );

    expect(mocks.formatCurrency).toHaveBeenLastCalledWith(
      12_500,
      undefined,
      'USD'
    );

    rerender(
      <ExpenseListItem item={expense()} merchant={{ payout_currency: null }} />
    );

    expect(mocks.formatCurrency).toHaveBeenLastCalledWith(
      12_500,
      undefined,
      'NGN'
    );
  });
});
