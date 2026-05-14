import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchSwitcher } from './BranchSwitcher';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  branches: [
    {
      active: true,
      address: '12 Broad Street',
      id: '123e4567-e89b-42d3-a456-426614174001',
      is_default: true,
      name: 'Lagos main',
    },
    {
      active: true,
      address: null,
      id: '123e4567-e89b-42d3-a456-426614174002',
      is_default: false,
      name: 'Abuja',
    },
  ],
  createMutateAsync: vi.fn(),
  deactivateMutateAsync: vi.fn(),
  setAllLocations: vi.fn(),
  setBranchId: vi.fn(),
  updateMutateAsync: vi.fn(),
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
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: disabled ? undefined : onPress,
          role: accessibilityRole === 'button' ? 'button' : undefined,
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
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: mocks.branches,
    error: null,
    isLoading: false,
  }),
  useCreateBranch: () => ({
    isPending: false,
    mutateAsync: mocks.createMutateAsync,
  }),
  useDeactivateBranch: () => ({
    isPending: false,
    mutateAsync: mocks.deactivateMutateAsync,
  }),
  useUpdateBranch: () => ({
    isPending: false,
    mutateAsync: mocks.updateMutateAsync,
  }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({
    branchId: null,
    isAllLocations: true,
    scope: { type: 'all' },
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

describe('BranchSwitcher create and active branch filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.branches = [
      {
        active: true,
        address: '12 Broad Street',
        id: '123e4567-e89b-42d3-a456-426614174001',
        is_default: true,
        name: 'Lagos main',
      },
      {
        active: true,
        address: null,
        id: '123e4567-e89b-42d3-a456-426614174002',
        is_default: false,
        name: 'Abuja',
      },
    ];
  });

  it('does not render inactive branches as selectable scopes', () => {
    mocks.branches = [
      mocks.branches[0],
      {
        active: false,
        address: null,
        id: '123e4567-e89b-42d3-a456-426614174003',
        is_default: false,
        name: 'Inactive branch',
      },
    ];

    render(<BranchSwitcher />);

    expect(
      screen.queryByRole('button', { name: 'Switch to Inactive branch branch' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Manage Inactive branch branch' })
    ).not.toBeInTheDocument();
  });

  it('creates a branch from the add branch flow', async () => {
    mocks.createMutateAsync.mockResolvedValueOnce({});

    render(<BranchSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Add new branch' }));
    fireEvent.change(screen.getByLabelText('Branch name input'), {
      target: { value: 'Ikoyi' },
    });
    fireEvent.change(screen.getByLabelText('Branch address input'), {
      target: { value: '1 Osborne Road' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    await waitFor(() => {
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        address: '1 Osborne Road',
        isDefault: false,
        name: 'Ikoyi',
      });
    });
  });

  it('blocks branch creation when the branch name is invalid', () => {
    render(<BranchSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Add new branch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    expect(mocks.createMutateAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText(/(too (small|short).*2|expected string to have >=2)/i)
    ).toBeInTheDocument();
  });
});
