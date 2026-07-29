import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MutationOptions = {
  onError: (error: unknown) => void;
  onSuccess: (data: { verified: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  options: [] as MutationOptions[],
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: MutationOptions) => {
    mocks.options.push(options);
    return { isPending: false, mutate: vi.fn() };
  },
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
vi.mock('react-native', () => {
  function flattenStyle(
    style: Record<string, unknown> | Record<string, unknown>[] | undefined
  ): CSSProperties {
    const entries = Array.isArray(style) ? style : [style];
    return Object.assign({}, ...entries.filter(Boolean)) as CSSProperties;
  }

  return {
    ActivityIndicator: () => <span>loading</span>,
    Alert: { alert: mocks.alert },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
      style,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      style?: Record<string, unknown> | Record<string, unknown>[];
    }) => (
      <button
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={() => onPress?.()}
        style={flattenStyle(style)}
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
      maxLength,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      editable?: boolean;
      maxLength?: number;
      onChangeText?: (value: string) => void;
      value?: string;
    }) => (
      <input
        aria-label={accessibilityLabel}
        disabled={!editable}
        maxLength={maxLength}
        onChange={(event) => onChangeText?.(event.target.value)}
        value={value}
      />
    ),
    View: ({
      accessibilityLabel,
      children,
      style,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      style?: Record<string, unknown> | Record<string, unknown>[];
    }) =>
      accessibilityLabel ? (
        <fieldset aria-label={accessibilityLabel} style={flattenStyle(style)}>
          {children}
        </fieldset>
      ) : (
        <div style={flattenStyle(style)}>{children}</div>
      ),
  };
});
vi.mock('./DateOfBirthPicker', () => ({
  default: () => <input aria-label="Date of birth" />,
}));

import NinVerificationCard from './NinVerificationCard';

async function completeVerifiedMutation(): Promise<void> {
  const options = mocks.options[0];
  if (!options) throw new Error('Expected verification mutation options');
  try {
    await options.onSuccess({ verified: true });
  } catch (error) {
    options.onError(error);
  }
}

describe('NinVerificationCard readiness handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options = [];
  });

  it('keeps first and last name on one row and hides BVN fields until NIN is verified', () => {
    const props = {
      bvnVerified: false,
      dateOfBirth: '2000-01-01',
      firstName: 'Ada',
      lastName: 'Lovelace',
      mobileNo: '08012345678',
      onIdentityChange: vi.fn(),
      onVerified: vi.fn().mockResolvedValue(undefined),
      prefillBvn: null,
      verified: false,
    };
    const { rerender } = render(<NinVerificationCard {...props} />);

    fireEvent.click(
      screen.getByRole('button', { name: /toggle identity verification/i })
    );

    const nameRow = screen.getByLabelText('First and last name');
    expect(nameRow).toHaveStyle({ flexDirection: 'row' });
    expect(
      within(nameRow).getByRole('textbox', { name: 'First name input' })
    ).toBeInTheDocument();
    expect(
      within(nameRow).getByRole('textbox', { name: 'Last name input' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('BVN input')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Mobile number input')
    ).not.toBeInTheDocument();

    rerender(<NinVerificationCard {...props} verified />);

    expect(screen.getByLabelText('BVN input')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number input')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /toggle bvn verification section/i,
      })
    ).not.toBeInTheDocument();
  });

  it('shows BVN Pending when NIN is verified but BVN is incomplete', () => {
    render(
      <NinVerificationCard
        bvnVerified={false}
        dateOfBirth="2000-01-01"
        firstName="Ada"
        lastName="Lovelace"
        mobileNo="08012345678"
        onIdentityChange={vi.fn()}
        onVerified={vi.fn().mockResolvedValue(undefined)}
        verified
      />
    );

    expect(screen.getByLabelText('BVN Pending')).toBeInTheDocument();
    expect(screen.queryByLabelText('Not Started')).not.toBeInTheDocument();
  });

  it('awaits the readiness refresh before showing verified success', async () => {
    const events: string[] = [];
    let release!: () => void;
    const refresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(
      <NinVerificationCard
        bvnVerified={false}
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08012345678"
        onIdentityChange={vi.fn()}
        onVerified={() => {
          events.push('refresh');
          return refresh;
        }}
        verified={false}
      />
    );
    const completion = completeVerifiedMutation();
    await Promise.resolve();
    expect(events).toEqual(['refresh']);
    expect(mocks.alert).not.toHaveBeenCalled();
    release();
    await completion;
    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Your NIN has been verified successfully.'
    );
  });

  it('preserves verified success when the readiness refresh rejects', async () => {
    render(
      <NinVerificationCard
        bvnVerified={false}
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08012345678"
        onIdentityChange={vi.fn()}
        onVerified={() => Promise.reject(new Error('Readiness failed'))}
        verified={false}
      />
    );

    await completeVerifiedMutation();

    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Your NIN has been verified successfully. Your setup status will refresh shortly.'
    );
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Verification Error',
      expect.any(String)
    );
  });
});
