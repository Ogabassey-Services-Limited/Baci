import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffMember } from '@/lib/types/staff';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  handleChangeRole: vi.fn(),
  handleInvite: vi.fn(),
  inviteStaffState: {
    isPending: false,
  },
  refetch: vi.fn(),
  showStaffActions: vi.fn(),
  staffQuery: {
    data: [
      {
        accepted_at: '2026-04-13T11:00:00.000Z',
        created_at: '2026-04-13T10:00:00.000Z',
        email: 'ada@example.com',
        id: 'staff-1',
        invited_at: '2026-04-13T10:00:00.000Z',
        merchant_id: 'merchant-1',
        name: 'Ada',
        role: 'manager',
        status: 'active',
        user_id: 'user-1',
      },
    ] as StaffMember[] | undefined,
    error: null as Error | null,
    isError: false,
    isLoading: false,
    isRefetching: false,
  },
  statsQuery: {
    error: null as Error | null,
    isError: false,
    stats: { active: 1, pending: 0, total: 1 },
  },
  updateStaffState: {
    isPending: false,
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

vi.mock('@/components/staff/StaffSummaryCards', () => ({
  StaffSummaryCards: ({ stats }: { stats: { total: number } }) => (
    <div>summary:{stats.total}</div>
  ),
}));

vi.mock('@/components/staff/StaffListSection', () => ({
  StaffListSection: ({
    errorMessage,
    hasError,
    onInvitePress,
    onMemberPress,
    staff,
  }: {
    errorMessage?: string;
    hasError?: boolean;
    onInvitePress: () => void;
    onMemberPress: (member: { id: string }) => void;
    staff?: Array<{ id: string }>;
  }) => (
    <div>
      {hasError ? <span>error:{errorMessage}</span> : null}
      <button
        aria-label="Open invite from list"
        onClick={onInvitePress}
        type="button"
      >
        Invite from list
      </button>
      {staff?.[0] ? (
        <button
          aria-label="Open first staff member"
          onClick={() => onMemberPress(staff[0])}
          type="button"
        >
          Open first staff member
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('@/components/staff/InviteStaffSheet', () => ({
  InviteStaffSheet: ({
    isPending,
    onClose,
    onSubmit,
    visible,
  }: {
    isPending: boolean;
    onClose: () => void;
    onSubmit: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <span>invite-sheet</span>
        {isPending ? <span>invite-pending</span> : null}
        <button
          aria-label="Submit invite"
          disabled={isPending}
          onClick={() => onSubmit()}
          type="button"
        >
          Submit invite
        </button>
        <button aria-label="Close invite sheet" onClick={onClose} type="button">
          Close invite sheet
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/staff/StaffRoleSheet', () => ({
  StaffRoleSheet: ({ visible }: { visible: boolean }) =>
    visible ? <div>role-sheet</div> : null,
}));

vi.mock('@/hooks/useStaff', () => ({
  useInviteStaff: () => mocks.inviteStaffState,
  useRemoveStaff: () => ({}),
  useResendInvitation: () => ({}),
  useStaff: () => ({
    data: mocks.staffQuery.data,
    error: mocks.staffQuery.error,
    isError: mocks.staffQuery.isError,
    isLoading: mocks.staffQuery.isLoading,
    isRefetching: mocks.staffQuery.isRefetching,
    refetch: mocks.refetch,
  }),
  useStaffStats: () => mocks.statsQuery,
  useUpdateStaff: () => mocks.updateStaffState,
}));

vi.mock('@/hooks/useStaffScreenActions', () => ({
  useStaffScreenActions: () => ({
    handleChangeRole: mocks.handleChangeRole,
    handleInvite: mocks.handleInvite,
    showStaffActions: mocks.showStaffActions,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      primary: '#3b82f6',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
    },
    isDark: true,
    shadows: {
      sm: {},
    },
  }),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  return {
    Stack: {
      Screen: ({
        options,
      }: {
        options?: {
          headerLeft?: () => React.ReactNode;
          headerRight?: () => React.ReactNode;
          title?: string;
        };
      }) =>
        React.createElement(
          'div',
          null,
          options?.title
            ? React.createElement('span', null, options.title)
            : null,
          options?.headerLeft ? options.headerLeft() : null,
          options?.headerRight ? options.headerRight() : null
        ),
    },
    useRouter: () => ({
      back: mocks.back,
    }),
  };
});

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => <span>icon</span>,

  default: () => <span>icon</span>,
  __esModule: true,
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

import StaffScreen from '@/app/(admin)/staff';

describe('StaffScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteStaffState.isPending = false;
    setStaffState([
      {
        accepted_at: '2026-04-13T11:00:00.000Z',
        created_at: '2026-04-13T10:00:00.000Z',
        email: 'ada@example.com',
        id: 'staff-1',
        invited_at: '2026-04-13T10:00:00.000Z',
        merchant_id: 'merchant-1',
        name: 'Ada',
        role: 'manager',
        status: 'active',
        user_id: 'user-1',
      },
    ]);
  });

  it('renders the summary/list shell and opens the invite sheet from the header', () => {
    render(<StaffScreen />);

    expect(screen.getByText('summary:1')).toBeInTheDocument();
    expect(screen.queryByText('invite-sheet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));

    expect(screen.getByText('invite-sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit invite' }));

    expect(mocks.handleInvite).toHaveBeenCalledTimes(1);
  });

  it('forwards staff-member taps to the action hook', () => {
    render(<StaffScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open first staff member' })
    );

    expect(mocks.showStaffActions).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'staff-1' })
    );
  });

  it('passes the invite pending state through to the invite sheet', () => {
    mocks.inviteStaffState.isPending = true;

    render(<StaffScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));

    expect(screen.getByText('invite-pending')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit invite' })
    ).toBeDisabled();
  });

  it('passes fetch errors to the staff list section instead of showing an empty state', () => {
    setStaffState([], { error: new Error('Failed to fetch staff') });

    render(<StaffScreen />);

    expect(screen.getByText('error:Failed to fetch staff')).toBeInTheDocument();
  });
});
