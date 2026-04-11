import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { StaffAccountModal } from './StaffAccountModal';
import type { Branch } from './types';

vi.mock('@/components/ui/AppSheetModal', async () => {
  const React = await import('react');

  return {
    AppSheetModal: ({
      accessibilityLabel,
      children,
      visible,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      visible: boolean;
    }) =>
      visible
        ? React.createElement(
            'div',
            {
              'aria-label': accessibilityLabel ?? 'Sheet modal',
              role: 'dialog',
            },
            children
          )
        : null,
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: ({ color }: { color?: string }) =>
      React.createElement('span', { 'data-color': color }, 'loading'),
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => (visible ? React.createElement('div', null, children) : null),
    Platform: {
      OS: 'ios',
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
          role:
            accessibilityRole === 'radio' || accessibilityRole === 'button'
              ? accessibilityRole
              : undefined,
        },
        children
      ),
    ScrollView: ({
      accessibilityLabel,
      accessibilityRole,
      children,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        {
          'aria-label': accessibilityLabel,
          role: accessibilityRole,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({
      accessibilityLabel,
      accessibilityRole,
      children,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        {
          'aria-label': accessibilityLabel,
          role: accessibilityRole === 'alert' ? accessibilityRole : undefined,
        },
        children
      ),
  };
});

interface StaffMemberLike {
  id: string;
  name?: string | null;
  email: string;
}

function createBranches(): Branch[] {
  return [
    {
      id: 'branch-1',
      name: 'HQ',
      address: null,
      city: 'Lagos',
      is_default: true,
      active: true,
    },
    {
      id: 'branch-2',
      name: 'Lekki',
      address: null,
      city: 'Lagos',
      is_default: false,
      active: true,
    },
  ];
}

function createStaffMembers(): StaffMemberLike[] {
  return [
    {
      id: 'staff-1',
      name: 'Ada',
      email: 'ada@example.com',
    },
    {
      id: 'staff-2',
      name: null,
      email: 'kola@example.com',
    },
  ];
}

function createProps(
  overrides: Partial<React.ComponentProps<typeof StaffAccountModal>> = {}
): React.ComponentProps<typeof StaffAccountModal> {
  return {
    visible: true,
    colors: LIGHT_COLORS,
    accountName: 'Main till',
    onAccountNameChange: vi.fn(),
    selectedBranchId: null,
    onBranchSelect: vi.fn(),
    selectedStaffId: null,
    onStaffSelect: vi.fn(),
    branches: undefined,
    staffMembers: undefined,
    staffLoading: false,
    staffError: false,
    isPending: false,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('StaffAccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render modal content when visible is false', () => {
    render(<StaffAccountModal {...createProps({ visible: false })} />);

    expect(screen.queryByText('Create Staff Account')).toBeNull();
  });

  it('renders the account input and close control when optional data is absent', () => {
    const props = createProps();

    render(<StaffAccountModal {...props} />);

    expect(
      screen.getByRole('dialog', { name: 'Create staff account' })
    ).toBeTruthy();
    expect(screen.getByText('Create Staff Account')).toBeTruthy();
    expect(screen.getByDisplayValue('Main till')).toBeTruthy();
    expect(screen.getByText('No Branch')).toBeTruthy();
    expect(screen.getByText('No Staff')).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText("Account name (e.g. Kola's Account)"),
      {
        target: { value: 'Counter one' },
      }
    );
    fireEvent.click(screen.getByLabelText('Cancel staff account creation'));

    expect(props.onAccountNameChange).toHaveBeenCalledWith('Counter one');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('lets the user select a branch and staff member and submit', () => {
    const props = createProps({
      branches: createBranches(),
      staffMembers: createStaffMembers() as React.ComponentProps<
        typeof StaffAccountModal
      >['staffMembers'],
    });

    render(<StaffAccountModal {...props} />);

    fireEvent.click(screen.getByLabelText('Branch: HQ'));
    fireEvent.click(screen.getByLabelText('Staff: Ada'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Create staff account' })
    );

    expect(props.onBranchSelect).toHaveBeenCalledWith('branch-1');
    expect(props.onStaffSelect).toHaveBeenCalledWith('staff-1');
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders loading and error states for staff selection', () => {
    render(
      <StaffAccountModal
        {...createProps({
          staffLoading: true,
          staffError: true,
        })}
      />
    );

    expect(screen.getByText('Loading staff...')).toBeTruthy();
    expect(screen.getByText('Staff unavailable')).toBeTruthy();
  });

  it('disables submission until an account name exists', () => {
    render(
      <StaffAccountModal
        {...createProps({
          accountName: '   ',
        })}
      />
    );

    expect(
      (
        screen.getByRole('button', {
          name: 'Create staff account',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});
