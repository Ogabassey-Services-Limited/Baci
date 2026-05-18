import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StaffAccountsTabContent } from './StaffAccountsTabContent';
import type { StaffAccount } from './types';

const mocks = vi.hoisted(() => ({
  staffAccountCard: vi.fn(),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => (
    <span
      aria-label={name === 'person-add-outline' ? 'add person' : name}
      role="img"
    />
  ),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/staff/StaffAccountCard', () => ({
  StaffAccountCard: (props: {
    account: StaffAccount;
    onCopyAccountNumber: (value: string) => void;
  }) => {
    mocks.staffAccountCard(props);
    return <div>{props.account.name}</div>;
  },
}));

const account = {
  account_name: 'Baci Store',
  account_number: '1234567890',
  active: true,
  bank: 'Test Bank',
  branch_id: 'branch-1',
  code: 'TERM1',
  id: 'terminal-1',
  name: 'Ada terminal',
  payment_link: null,
  staff_id: null,
} satisfies StaffAccount;

describe('StaffAccountsTabContent', () => {
  it('renders the empty staff account state', () => {
    render(
      <StaffAccountsTabContent
        accounts={[]}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        onCopyAccountNumber={vi.fn()}
      />
    );

    expect(screen.getByText('No Staff Accounts Yet')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /add person/i })
    ).toBeInTheDocument();
  });

  it('passes account rows to StaffAccountCard', () => {
    const onCopyAccountNumber = vi.fn();

    render(
      <StaffAccountsTabContent
        accounts={[account]}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        onCopyAccountNumber={onCopyAccountNumber}
      />
    );

    expect(screen.getByText('Ada terminal')).toBeInTheDocument();
    expect(mocks.staffAccountCard).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        onCopyAccountNumber,
      })
    );
  });
});
