import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseDetails } from './ExpenseDetails';
import type { ExpenseDetail, ExpenseDetailColors } from './types';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  linking: {
    canOpenURL: vi.fn(() => Promise.resolve(true)),
    openURL: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Linking: mocks.linking,
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
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors: ExpenseDetailColors = {
  background: '#020617',
  card: '#111827',
  border: '#334155',
  primary: '#3b82f6',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
};

const expense = (overrides: Partial<ExpenseDetail> = {}): ExpenseDetail => ({
  amount: 12_500,
  branch_id: 'branch-1',
  category: 'Inventory',
  date: '2026-05-05T00:00:00.000Z',
  description: 'Office internet',
  id: 'expense-1',
  receipt_url: null,
  reference: 'EXP-1',
  ...overrides,
});

describe('ExpenseDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.linking.canOpenURL.mockResolvedValue(true);
    mocks.linking.openURL.mockResolvedValue(undefined);
  });

  it('renders the formatted amount, metadata, and branch name', () => {
    render(
      <ExpenseDetails
        expense={expense()}
        branchName="Lagos main"
        colors={colors}
        formattedAmount="NGN12,500.00"
        cardShadow={{}}
      />
    );

    expect(screen.getByText('NGN12,500.00')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('May 5, 2026')).toBeInTheDocument();
    expect(screen.getByText('Lagos main')).toBeInTheDocument();
  });

  it('shows invalid date text for malformed dates', () => {
    render(
      <ExpenseDetails
        expense={expense({ date: 'not-a-date' })}
        branchName="Lagos main"
        colors={colors}
        formattedAmount="NGN12,500.00"
        cardShadow={{}}
      />
    );

    expect(screen.getByText('Invalid date')).toBeInTheDocument();
  });

  it('opens valid receipt links from the receipt action', async () => {
    render(
      <ExpenseDetails
        expense={expense({ receipt_url: 'https://example.com/receipt.jpg' })}
        branchName="Lagos main"
        colors={colors}
        formattedAmount="NGN12,500.00"
        cardShadow={{}}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'View attached receipt' })
    );

    expect(mocks.linking.canOpenURL).toHaveBeenCalledWith(
      'https://example.com/receipt.jpg'
    );
    await waitFor(() => {
      expect(mocks.linking.openURL).toHaveBeenCalledWith(
        'https://example.com/receipt.jpg'
      );
    });
  });

  it('shows an alert when receipt links cannot be opened', async () => {
    mocks.linking.canOpenURL.mockResolvedValue(false);

    render(
      <ExpenseDetails
        expense={expense({ receipt_url: 'https://example.com/receipt.jpg' })}
        branchName="Lagos main"
        colors={colors}
        formattedAmount="NGN12,500.00"
        cardShadow={{}}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'View attached receipt' })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Receipt unavailable',
        'This receipt link cannot be opened.'
      );
    });
    expect(mocks.linking.openURL).not.toHaveBeenCalled();
  });
});
