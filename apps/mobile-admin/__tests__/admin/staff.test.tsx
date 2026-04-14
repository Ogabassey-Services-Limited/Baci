import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffMember } from '@/lib/types/staff';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  inviteStaff: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  refetch: vi.fn(),
  removeStaff: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  resendInvitation: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  router: {
    back: vi.fn(),
  },
  share: vi.fn(),
  staffQuery: {
    data: [] as StaffMember[] | undefined,
    error: null as Error | null,
    isError: false,
    isLoading: false,
    isRefetching: false,
  },
  statsQuery: {
    error: null as Error | null,
    isError: false,
    stats: {
      active: 0,
      pending: 0,
      total: 0,
    },
  },
  updateStaff: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
}));

function setStaffState(
  staff: StaffMember[] | undefined,
  options: {
    error?: Error | null;
    isLoading?: boolean;
    isRefetching?: boolean;
    statsError?: Error | null;
  } = {}
) {
  mocks.staffQuery.data = staff;
  mocks.staffQuery.error = options.error ?? null;
  mocks.staffQuery.isError = Boolean(options.error);
  mocks.staffQuery.isLoading = options.isLoading ?? false;
  mocks.staffQuery.isRefetching = options.isRefetching ?? false;
  mocks.statsQuery.error = options.statsError ?? null;
  mocks.statsQuery.isError = Boolean(options.statsError);
  mocks.statsQuery.stats = {
    active: staff?.filter((member) => member.status === 'active').length ?? 0,
    pending: staff?.filter((member) => member.status === 'pending').length ?? 0,
    total: staff?.length ?? 0,
  };
}

vi.mock('expo-router', async () => {
  const React = await import('react');

  return {
    Stack: Object.assign(
      ({ children }: { children?: React.ReactNode }) => children,
      {
        Screen: ({
          options,
        }: {
          options?: {
            headerLeft?: () => React.ReactNode;
            headerRight?: () => React.ReactNode;
          };
        }) =>
          React.createElement(
            'div',
            { 'data-testid': 'screen-header' },
            options?.headerLeft?.(),
            options?.headerRight?.()
          ),
      }
    ),
    useRouter: () => mocks.router,
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      cardHover: '#1f2937',
      error: '#ef4444',
      errorLight: '#fee2e2',
      gold: '#f59e0b',
      goldLight: '#fef3c7',
      primary: '#3b82f6',
      primaryLight: '#dbeafe',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      warning: '#f59e0b',
      warningLight: '#fef3c7',
    },
    isDark: false,
    shadows: {
      sm: {},
    },
  }),
}));

vi.mock('@/hooks/useStaff', () => ({
  useInviteStaff: () => mocks.inviteStaff,
  useRemoveStaff: () => mocks.removeStaff,
  useResendInvitation: () => mocks.resendInvitation,
  useStaff: () => ({
    data: mocks.staffQuery.data,
    error: mocks.staffQuery.error,
    isError: mocks.staffQuery.isError,
    isLoading: mocks.staffQuery.isLoading,
    isRefetching: mocks.staffQuery.isRefetching,
    refetch: mocks.refetch,
  }),
  useStaffStats: () => mocks.statsQuery,
  useUpdateStaff: () => mocks.updateStaff,
}));

vi.mock('@/components/ui/KeyboardAwareModalContainer', () => ({
  KeyboardAwareModalContainer: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    ListEmptyComponent,
    refreshControl,
    renderItem,
  }: {
    data?: StaffMember[];
    ListEmptyComponent?: React.ReactNode;
    refreshControl?: React.ReactNode;
    renderItem: ({ item }: { item: StaffMember }) => React.ReactNode;
  }) => (
    <div>
      {refreshControl}
      {data && data.length > 0
        ? data.map((item) => <div key={item.id}>{renderItem({ item })}</div>)
        : ListEmptyComponent}
    </div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: {
      alert: mocks.alert,
    },
    Animated: {
      Value: class {
        constructor(public value: number) {}
      },
      spring: () => ({
        start: () => undefined,
      }),
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) =>
      visible ? React.createElement('div', { role: 'dialog' }, children) : null,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean; disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.checked,
          disabled,
          onClick: () => onPress?.(),
          role:
            accessibilityRole === 'button' ||
            accessibilityRole === 'togglebutton'
              ? 'button'
              : undefined,
          type: 'button',
        },
        children
      ),
    RefreshControl: ({ refreshing }: { refreshing?: boolean }) =>
      React.createElement('div', {
        'data-refreshing': refreshing ? 'true' : 'false',
        'data-testid': 'staff-refresh-control',
      }),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Share: {
      share: mocks.share,
    },
    StyleSheet: {
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      autoComplete,
      autoCorrect,
      importantForAutofill,
      onChangeText,
      placeholder,
      textContentType,
      value,
    }: {
      accessibilityLabel?: string;
      autoComplete?: string;
      autoCorrect?: boolean;
      importantForAutofill?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      textContentType?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        autoComplete,
        'data-auto-correct': autoCorrect ? 'true' : 'false',
        'data-important-for-autofill': importantForAutofill,
        'data-text-content-type': textContentType,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

import StaffScreen from '@/app/(admin)/staff';

describe('StaffScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStaffState([], { isLoading: false, isRefetching: false });
    mocks.inviteStaff.isPending = false;
    mocks.updateStaff.isPending = false;
  });

  it('renders a loading state before the staff list is ready', () => {
    setStaffState([], { isLoading: true });

    render(<StaffScreen />);

    expect(screen.getByText('Loading team members...')).toBeInTheDocument();
    expect(screen.queryByText('No team members yet')).not.toBeInTheDocument();
  });

  it('uses refetching for pull-to-refresh and shows an email fallback', () => {
    setStaffState(
      [
        {
          accepted_at: null,
          created_at: '2026-04-14T10:00:00.000Z',
          email: '',
          id: 'staff-1',
          invited_at: '2026-04-14T10:00:00.000Z',
          merchant_id: 'merchant-1',
          name: '',
          role: 'sales_rep',
          status: 'pending',
          user_id: null,
        },
      ],
      { isRefetching: true }
    );

    render(<StaffScreen />);

    expect(screen.getByTestId('staff-refresh-control')).toHaveAttribute(
      'data-refreshing',
      'true'
    );
    expect(screen.getByText('Unknown User')).toBeInTheDocument();
    expect(screen.getByText('Email unavailable')).toBeInTheDocument();
  });

  it('adds autofill metadata to invite inputs and disables submit without email', () => {
    setStaffState([], { isLoading: false });

    render(<StaffScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));

    expect(screen.getByLabelText('Invite email')).toHaveAttribute(
      'autocomplete',
      'email'
    );
    expect(screen.getByLabelText('Invite email')).toHaveAttribute(
      'data-text-content-type',
      'emailAddress'
    );
    expect(screen.getByLabelText('Invite name')).toHaveAttribute(
      'autocomplete',
      'name'
    );
    expect(screen.getByLabelText('Invite name')).toHaveAttribute(
      'data-text-content-type',
      'name'
    );
    expect(
      screen.getByRole('button', { name: 'Send invitation' })
    ).toBeDisabled();
  });

  it('renders a retryable error state instead of the empty state', () => {
    setStaffState([], { error: new Error('Staff query failed') });

    render(<StaffScreen />);

    expect(
      screen.getByText('Unable to load team members.')
    ).toBeInTheDocument();
    expect(screen.getByText('Staff query failed')).toBeInTheDocument();
    expect(screen.queryByText('No team members yet')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading team members' })
    );

    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('shows a pending state for invite submission and prevents duplicate sends', () => {
    setStaffState([], { isLoading: false });
    mocks.inviteStaff.isPending = true;

    render(<StaffScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));
    fireEvent.change(screen.getByLabelText('Invite email'), {
      target: { value: 'staff@example.com' },
    });

    const sendButton = screen.getByRole('button', { name: 'Send invitation' });
    expect(sendButton).toBeDisabled();
    expect(screen.getByText('loading')).toBeInTheDocument();

    fireEvent.click(sendButton);
    expect(mocks.inviteStaff.mutateAsync).not.toHaveBeenCalled();
  });

  it('returns the invite button from pending to enabled when invite submission fails', async () => {
    setStaffState([], { isLoading: false });
    let rejectInvite: ((reason?: unknown) => void) | undefined;
    mocks.inviteStaff.mutateAsync.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectInvite = reject;
        })
    );

    const { rerender } = render(<StaffScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));
    fireEvent.change(screen.getByLabelText('Invite email'), {
      target: { value: 'staff@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    mocks.inviteStaff.isPending = true;
    rerender(<StaffScreen />);

    let sendButton = screen.getByRole('button', { name: 'Send invitation' });
    expect(sendButton).toBeDisabled();

    rejectInvite?.(new Error('Invite failed'));
    mocks.inviteStaff.isPending = false;
    rerender(<StaffScreen />);

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Invite failed');
    });

    sendButton = screen.getByRole('button', { name: 'Send invitation' });
    expect(sendButton).not.toBeDisabled();
  });
});
