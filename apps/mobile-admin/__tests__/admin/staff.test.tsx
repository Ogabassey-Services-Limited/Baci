import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  handleChangeRole: vi.fn(),
  handleInvite: vi.fn(),
  showStaffActions: vi.fn(),
}));

vi.mock('@/components/staff/StaffSummaryCards', () => ({
  StaffSummaryCards: ({ stats }: { stats: { total: number } }) => (
    <div>summary:{stats.total}</div>
  ),
}));

vi.mock('@/components/staff/StaffListSection', () => ({
  StaffListSection: ({
    onInvitePress,
    onMemberPress,
    staff,
  }: {
    onInvitePress: () => void;
    onMemberPress: (member: { id: string }) => void;
    staff?: Array<{ id: string }>;
  }) => (
    <div>
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
    onClose,
    onSubmit,
    visible,
  }: {
    onClose: () => void;
    onSubmit: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <span>invite-sheet</span>
        <button aria-label="Submit invite" onClick={onSubmit} type="button">
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
  useInviteStaff: () => ({ isPending: false }),
  useRemoveStaff: () => ({}),
  useResendInvitation: () => ({}),
  useStaff: () => ({
    data: [
      {
        id: 'staff-1',
        merchant_id: 'merchant-1',
        user_id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada',
        role: 'manager',
        status: 'active',
        created_at: '2026-04-13T10:00:00.000Z',
        invited_at: '2026-04-13T10:00:00.000Z',
        accepted_at: '2026-04-13T11:00:00.000Z',
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useStaffStats: () => ({
    stats: { active: 1, pending: 0, total: 1 },
  }),
  useUpdateStaff: () => ({ isPending: false }),
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

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
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
});
