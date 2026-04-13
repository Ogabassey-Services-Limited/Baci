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

  it('renders the verifying state', () => {
    render(
      <PayoutVerificationStatus
        accountName={null}
        colors={colors}
        isVerifying={true}
        verifyError={null}
      />
    );

    expect(screen.getByText('Verifying account...')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid account')).not.toBeInTheDocument();
  });

  it('renders no output in the idle state', () => {
    const { container } = render(
      <PayoutVerificationStatus
        accountName={null}
        colors={colors}
        isVerifying={false}
        verifyError={null}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the success state', () => {
    render(
      <PayoutVerificationStatus
        accountName="John Doe"
        colors={colors}
        isVerifying={false}
        verifyError={null}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Verifying account...')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid account')).not.toBeInTheDocument();
  });

  it('renders the error state', () => {
    render(
      <PayoutVerificationStatus
        accountName="John Doe"
        colors={colors}
        isVerifying={false}
        verifyError="Invalid account"
      />
    );

    expect(screen.getByText('Invalid account')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Verifying account...')).not.toBeInTheDocument();
  });
});
