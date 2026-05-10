import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseStatusShell } from './ExpenseStatusShell';
import type { ExpenseDetailColors } from './types';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('react-native', () => ({
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

describe('ExpenseStatusShell', () => {
  it('renders the loading message', () => {
    render(<ExpenseStatusShell status="loading" colors={colors} />);

    expect(screen.getByText('Loading expense details...')).toBeInTheDocument();
  });

  it('renders the default missing message', () => {
    render(<ExpenseStatusShell status="not-found" colors={colors} />);

    expect(screen.getByText('Expense not found.')).toBeInTheDocument();
  });

  it('renders an error message when expense loading fails', () => {
    render(
      <ExpenseStatusShell
        status="error"
        colors={colors}
        errorMessage="Database unavailable"
      />
    );

    expect(screen.getByText('Could not load expense.')).toBeInTheDocument();
    expect(screen.getByText('Database unavailable')).toBeInTheDocument();
    expect(
      document.querySelector('[data-icon="warning-outline"]')
    ).toBeTruthy();
  });
});
