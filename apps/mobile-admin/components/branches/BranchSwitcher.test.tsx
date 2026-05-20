import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchSwitcher } from './BranchSwitcher';

const mocks = vi.hoisted(() => ({
  branches: [
    {
      id: '123e4567-e89b-42d3-a456-426614174001',
      name: 'Lagos main',
      address: '12 Broad Street',
      is_default: true,
      active: true,
    },
    {
      id: '123e4567-e89b-42d3-a456-426614174002',
      name: 'Abuja',
      address: null,
      is_default: false,
      active: true,
    },
  ],
  setAllLocations: vi.fn(),
  setBranchId: vi.fn(),
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  deactivateMutateAsync: vi.fn(),
  alert: vi.fn(),
  branchesError: null as Error | null,
  branchesLoading: false,
}));

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
  };
});

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
}));

vi.mock('@/components/ui/KeyboardAwareModalContainer', async () => {
  const React = await import('react');
  return {
    KeyboardAwareModalContainer: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => React.createElement('div', null, children),
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible: boolean;
    }) => (visible ? React.createElement('div', null, children) : null),
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
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          disabled,
          onClick: onPress,
          role: accessibilityRole || 'button',
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: mocks.branches,
    error: mocks.branchesError,
    isLoading: mocks.branchesLoading,
  }),
  useCreateBranch: () => ({
    isPending: false,
    mutateAsync: mocks.createMutateAsync,
  }),
  useUpdateBranch: () => ({
    isPending: false,
    mutateAsync: mocks.updateMutateAsync,
  }),
  useDeactivateBranch: () => ({
    isPending: false,
    mutateAsync: mocks.deactivateMutateAsync,
  }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({
    scope: { type: 'all' },
    branchId: null,
    isAllLocations: true,
    setAllLocations: mocks.setAllLocations,
    setBranchId: mocks.setBranchId,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      notification: '#f00',
      primary: '#2563eb',
      text: '#111',
      textMuted: '#777',
      textOnPrimary: '#fff',
      textSecondary: '#555',
    },
    shadows: { sm: {} },
  }),
}));

describe('BranchSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.branches = [
      {
        id: '123e4567-e89b-42d3-a456-426614174001',
        name: 'Lagos main',
        address: '12 Broad Street',
        is_default: true,
        active: true,
      },
      {
        id: '123e4567-e89b-42d3-a456-426614174002',
        name: 'Abuja',
        address: null,
        is_default: false,
        active: true,
      },
    ];
    mocks.branchesError = null;
    mocks.branchesLoading = false;
  });

  it('shows only add branch when no active branches exist', () => {
    mocks.branches = [];

    render(<BranchSwitcher />);

    expect(screen.queryByText('All locations')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add new branch' })
    ).toBeInTheDocument();
  });

  it('does not expose branch filter controls when only one active branch exists', () => {
    mocks.branches = [mocks.branches[0]];

    render(<BranchSwitcher />);

    expect(screen.queryByText('All locations')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show all branch locations' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch to Lagos main branch' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Manage Lagos main branch' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add new branch' })
    ).toBeInTheDocument();
  });

  it('renders a loading state while branches load', () => {
    mocks.branchesLoading = true;

    render(<BranchSwitcher />);

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add new branch' })
    ).not.toBeInTheDocument();
  });

  it('renders a branch loading error instead of stale branch controls', () => {
    mocks.branchesError = new Error('Branch query failed');

    render(<BranchSwitcher />);

    expect(screen.getByText('Could not load branches')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Switch to Lagos main branch' })
    ).not.toBeInTheDocument();
  });

  it('shows all locations as an explicit branch scope', () => {
    render(<BranchSwitcher />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Show all branch locations' })
    );

    expect(screen.getByText('All locations')).toBeInTheDocument();
    expect(mocks.setAllLocations).toHaveBeenCalledTimes(1);
  });

  it('selects concrete branch scopes through useBranchScope', () => {
    render(<BranchSwitcher />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to Lagos main branch' })
    );

    expect(mocks.setBranchId).toHaveBeenCalledWith(
      '123e4567-e89b-42d3-a456-426614174001'
    );
  });

  it('opens a visible edit flow from each branch manage button', async () => {
    render(<BranchSwitcher />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage Lagos main branch' })
    );
    fireEvent.change(screen.getByLabelText('Branch name input'), {
      target: { value: 'Lekki main' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save branch' }));

    await waitFor(() => {
      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
        branchId: '123e4567-e89b-42d3-a456-426614174001',
        input: {
          address: '12 Broad Street',
          name: 'Lekki main',
        },
      });
    });
  });

  it('sends null when clearing a branch address in the edit flow', async () => {
    render(<BranchSwitcher />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage Lagos main branch' })
    );
    fireEvent.change(screen.getByLabelText('Branch address input'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save branch' }));

    await waitFor(() => {
      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
        branchId: '123e4567-e89b-42d3-a456-426614174001',
        input: {
          address: null,
          name: 'Lagos main',
        },
      });
    });
  });

  it('deactivates a branch from the edit flow when another active branch exists', async () => {
    render(<BranchSwitcher />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage Abuja branch' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate branch' }));

    await waitFor(() => {
      expect(mocks.deactivateMutateAsync).toHaveBeenCalledWith(
        '123e4567-e89b-42d3-a456-426614174002'
      );
    });
  });
});
