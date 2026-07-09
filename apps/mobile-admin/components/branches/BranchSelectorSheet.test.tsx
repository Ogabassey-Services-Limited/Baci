import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Branch } from '@/schemas/branch';
import { BranchSelectorSheet } from './BranchSelectorSheet';

const branches = [
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
] as Branch[];

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
    default: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
    __esModule: true,
  };
});

vi.mock('@/components/ui/AppSheetModal', async () => {
  const React = await import('react');
  return {
    AppSheetModal: ({
      children,
      onClose,
      visible,
    }: {
      children?: React.ReactNode;
      onClose?: () => void;
      visible?: boolean;
    }) =>
      visible
        ? React.createElement(
            'div',
            null,
            React.createElement(
              'button',
              { onClick: onClose, type: 'button' },
              'Close'
            ),
            children
          )
        : null,
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-label': accessibilityLabel,
          onClick: onPress,
          role: accessibilityRole || 'button',
        },
        children
      ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      cardHover: '#eee',
      inputBg: '#f5f5f5',
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

describe('BranchSelectorSheet', () => {
  const onAddBranch = vi.fn();
  const onClose = vi.fn();
  const onManageBranch = vi.fn();
  const onSelectAll = vi.fn();
  const onSelectBranch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={false}
      />
    );

    expect(screen.queryByText('Choose location')).not.toBeInTheDocument();
  });

  it('renders the title and every branch row when visible', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    expect(screen.getByText('Choose location')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Show all branch locations' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Switch to Lagos main branch' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Switch to Abuja branch' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Manage Lagos main branch' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Manage Abuja branch' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add new branch' })
    ).toBeInTheDocument();
  });

  it('marks the all-locations row as checked when isAllLocations is true', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    expect(
      screen.getByRole('radio', { name: 'Show all branch locations' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('radio', { name: 'Switch to Lagos main branch' })
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('radio', { name: 'Switch to Abuja branch' })
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the matching branch row as checked when a branch is selected', () => {
    render(
      <BranchSelectorSheet
        branchId="123e4567-e89b-42d3-a456-426614174002"
        branches={branches}
        isAllLocations={false}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    expect(
      screen.getByRole('radio', { name: 'Show all branch locations' })
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('radio', { name: 'Switch to Lagos main branch' })
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('radio', { name: 'Switch to Abuja branch' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onSelectAll when the all-locations row is pressed', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={false}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('radio', { name: 'Show all branch locations' })
    );

    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectBranch with the pressed branch', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('radio', { name: 'Switch to Abuja branch' })
    );

    expect(onSelectBranch).toHaveBeenCalledTimes(1);
    expect(onSelectBranch).toHaveBeenCalledWith(branches[1]);
  });

  it('calls onManageBranch with the pressed branch', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage Lagos main branch' })
    );

    expect(onManageBranch).toHaveBeenCalledTimes(1);
    expect(onManageBranch).toHaveBeenCalledWith(branches[0]);
  });

  it('calls onAddBranch when the add branch row is pressed', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add new branch' }));

    expect(onAddBranch).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the sheet close affordance is pressed', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={branches}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders no branch rows when the branch list is empty', () => {
    render(
      <BranchSelectorSheet
        branchId={null}
        branches={[]}
        isAllLocations={true}
        onAddBranch={onAddBranch}
        onClose={onClose}
        onManageBranch={onManageBranch}
        onSelectAll={onSelectAll}
        onSelectBranch={onSelectBranch}
        visible={true}
      />
    );

    expect(
      screen.getByRole('radio', { name: 'Show all branch locations' })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Add new branch' })
    ).toBeInTheDocument();
  });
});
