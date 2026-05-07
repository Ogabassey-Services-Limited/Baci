import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const branchFixtures = () => [
    {
      id: 'branch-1',
      name: 'Lagos main',
      address: null,
      city: 'Lagos',
      is_default: true,
      active: true,
    },
    {
      id: 'branch-2',
      name: 'Abuja',
      address: null,
      city: 'Abuja',
      is_default: false,
      active: true,
    },
    {
      id: 'branch-3',
      name: 'Closed test branch',
      address: null,
      city: 'Lagos',
      is_default: false,
      active: false,
    },
  ];

  return {
    branchFixtures,
    branches: branchFixtures(),
    createAccount: vi.fn(),
    createBranch: vi.fn(),
    deactivateBranch: vi.fn(),
    alert: vi.fn(),
    updateBranch: vi.fn(),
  };
});

vi.mock('@/hooks/useStaffAccounts', () => ({
  useStaffAccounts: () => ({
    accounts: [],
    branches: mocks.branches,
    isLoading: false,
    hasError: false,
    createAccountMutation: { isPending: false, mutate: mocks.createAccount },
    createBranchMutation: { isPending: false, mutate: mocks.createBranch },
    updateBranchMutation: { isPending: false, mutate: mocks.updateBranch },
    deactivateBranchMutation: {
      isPending: false,
      mutate: mocks.deactivateBranch,
    },
    copyToClipboard: vi.fn(),
    retryAll: vi.fn(),
  }),
}));

vi.mock('@/hooks/useStaff', () => ({
  useStaff: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('@/hooks/useBranches', () => ({
  useDeactivateBranch: () => ({
    isPending: false,
    mutate: mocks.deactivateBranch,
  }),
  useUpdateBranch: () => ({
    isPending: false,
    mutate: mocks.updateBranch,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#3b82f6' }),
    isDark: true,
    shadows: { sm: {}, md: {}, lg: {} },
  }),
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    accessibilityLabel,
    children,
    visible,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label={accessibilityLabel} role="dialog">
        {children}
      </section>
    ) : null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: {
    alert: (...args: unknown[]) => mocks.alert(...args),
  },
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
    accessibilityState?: { disabled?: boolean; selected?: boolean };
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-disabled={accessibilityState?.disabled}
      aria-label={accessibilityLabel}
      aria-pressed={accessibilityState?.selected}
      disabled={disabled}
      onClick={() => onPress?.()}
      role={
        accessibilityRole === 'button' || accessibilityRole === 'tab'
          ? accessibilityRole
          : undefined
      }
      type="button"
    >
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    placeholder,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import StaffAccountsScreen from '@/app/(admin)/staff-accounts';

function pressAlertButton(title: string, label: string) {
  const alertCall = mocks.alert.mock.calls.find(
    ([alertTitle]) => alertTitle === title
  );
  const buttons = alertCall?.[2] as Array<{
    onPress?: () => void;
    text?: string;
  }>;
  buttons.find((button) => button.text === label)?.onPress?.();
}

describe('StaffAccountsScreen branch management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.branches = mocks.branchFixtures();
  });

  it('shows only active branches in the branch list', () => {
    render(<StaffAccountsScreen />);

    fireEvent.click(screen.getByRole('tab', { name: 'Branches Tab' }));

    expect(screen.getByText(/Lagos main/)).toBeInTheDocument();
    expect(screen.getAllByText('Abuja').length).toBeGreaterThan(0);
    expect(screen.queryByText('Closed test branch')).not.toBeInTheDocument();
  });

  it('opens an edit sheet and saves branch updates through the mutation', () => {
    render(<StaffAccountsScreen />);

    fireEvent.click(screen.getByRole('tab', { name: 'Branches Tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lagos main' }));
    expect(
      screen.getByRole('dialog', { name: 'Edit branch' })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Branch name'), {
      target: { value: 'Lagos flagship' },
    });
    fireEvent.change(screen.getByLabelText('Branch city'), {
      target: { value: 'Ikeja' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save branch' }));

    expect(mocks.updateBranch).toHaveBeenCalledWith(
      {
        branchId: 'branch-1',
        input: { name: 'Lagos flagship', city: 'Ikeja' },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
  });

  it('creates branches through the hook mutation without duplicate per-call alerts', () => {
    render(<StaffAccountsScreen />);

    fireEvent.click(screen.getByRole('tab', { name: 'Branches Tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create new branch' }));
    expect(
      screen.getByRole('dialog', { name: 'Create branch' })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Branch name'), {
      target: { value: 'Lekki' },
    });
    fireEvent.change(screen.getByLabelText('Branch city'), {
      target: { value: 'Lagos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    expect(mocks.createBranch).toHaveBeenCalledWith(
      {
        name: 'Lekki',
        city: 'Lagos',
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );
  });

  it('deactivates a default branch when another active branch exists', () => {
    render(<StaffAccountsScreen />);

    fireEvent.click(screen.getByRole('tab', { name: 'Branches Tab' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Lagos main' })
    );
    pressAlertButton('Deactivate branch', 'Deactivate');

    expect(mocks.deactivateBranch).toHaveBeenCalledWith(
      'branch-1',
      expect.objectContaining({
        onError: expect.any(Function),
      })
    );
    expect(mocks.alert).toHaveBeenCalledWith(
      'Deactivate branch',
      'This branch will be hidden from branch selectors.',
      expect.any(Array)
    );
  });

  it('prevents deactivating the only active branch', () => {
    mocks.branches = [mocks.branches[0], mocks.branches[2]];

    render(<StaffAccountsScreen />);

    fireEvent.click(screen.getByRole('tab', { name: 'Branches Tab' }));

    const deactivateButton = screen.getByRole('button', {
      name: 'Deactivate Lagos main',
    });
    expect(deactivateButton).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(deactivateButton);
    expect(mocks.deactivateBranch).not.toHaveBeenCalled();
  });
});
