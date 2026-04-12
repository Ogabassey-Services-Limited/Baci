import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PayoutVerificationStatus } from './PayoutVerificationStatus';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('PayoutVerificationStatus', () => {
  const colors = {
    error: '#dc2626',
    success: '#16a34a',
    successLight: '#dcfce7',
    textSecondary: '#475569',
  };

  it('renders verification, success, and error states', () => {
    const { rerender } = render(
      <PayoutVerificationStatus
        accountName={null}
        colors={colors}
        isVerifying={true}
        verifyError={null}
      />
    );

    expect(screen.getByText('Verifying account...')).toBeInTheDocument();

    rerender(
      <PayoutVerificationStatus
        accountName="John Doe"
        colors={colors}
        isVerifying={false}
        verifyError={null}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();

    rerender(
      <PayoutVerificationStatus
        accountName={null}
        colors={colors}
        isVerifying={false}
        verifyError="Invalid account"
      />
    );

    expect(screen.getByText('Invalid account')).toBeInTheDocument();
  });
});
