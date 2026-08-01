import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mocks.mutate }),
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
  NetworkError: class NetworkError extends Error {},
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      card: '#111827',
      inputBg: '#0f172a',
      primary: '#3b82f6',
      success: '#22c55e',
      successLight: '#052e16',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
    },
    shadows: {},
  }),
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('react-native', () => ({
  ActivityIndicator: () => null,
  Alert: { alert: vi.fn() },
  Pressable: ({
    children,
    disabled,
    onPress,
    accessibilityLabel,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (value: unknown) => value },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    editable = true,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    editable?: boolean;
    onChangeText?: (value: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      disabled={!editable}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./DateOfBirthPicker', () => ({
  default: ({
    disabled,
    onChange,
    value,
  }: {
    disabled?: boolean;
    onChange: (value: string) => void;
    value: string;
  }) => (
    <input
      aria-label="Date of birth"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

import NinVerificationCard from './NinVerificationCard';

function VerifiedNinHarness() {
  const [identity, setIdentity] = useState({
    dateOfBirth: '2000-01-01',
    firstName: 'Ada',
    lastName: 'Lovelace',
    mobileNo: '08012345678',
  });
  return (
    <NinVerificationCard
      {...identity}
      bvnVerified={false}
      onIdentityChange={setIdentity}
      onVerified={vi.fn().mockResolvedValue(undefined)}
      prefillBvn="12345678901"
      verified
    />
  );
}

describe('NinVerificationCard shared identity lock', () => {
  it('keeps shared identity fields editable for a BVN correction after NIN verification', () => {
    render(<VerifiedNinHarness />);
    fireEvent.click(
      screen.getByRole('button', { name: /toggle identity verification/i })
    );

    expect(screen.getByLabelText('NIN input')).toBeDisabled();
    expect(screen.getByLabelText('First name input')).toBeEnabled();
    expect(screen.getByLabelText('Last name input')).toBeEnabled();
    expect(screen.getByLabelText('Date of birth')).toBeEnabled();

    fireEvent.change(screen.getByLabelText('First name input'), {
      target: { value: 'Grace' },
    });
    fireEvent.change(screen.getByLabelText('Last name input'), {
      target: { value: 'Hopper' },
    });
    fireEvent.change(screen.getByLabelText('Date of birth'), {
      target: { value: '1991-12-09' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify BVN' }));

    expect(screen.getByLabelText('First name input')).toHaveValue('Grace');
    expect(screen.getByLabelText('Last name input')).toHaveValue('Hopper');
    expect(screen.getByLabelText('Date of birth')).toHaveValue('1991-12-09');
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });

  it('locks NIN and shared identity fields after both verifications complete', () => {
    render(
      <NinVerificationCard
        bvnVerified
        dateOfBirth="2000-01-01"
        firstName="Ada"
        lastName="Lovelace"
        mobileNo="08012345678"
        onIdentityChange={vi.fn()}
        onVerified={vi.fn().mockResolvedValue(undefined)}
        verified
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /toggle identity verification/i })
    );

    expect(screen.getByLabelText('NIN input')).toBeDisabled();
    expect(screen.getByLabelText('First name input')).toBeDisabled();
    expect(screen.getByLabelText('Last name input')).toBeDisabled();
    expect(screen.getByLabelText('Date of birth')).toBeDisabled();
  });
});
