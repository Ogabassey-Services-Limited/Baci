import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { StaffRoleSheet } from './StaffRoleSheet';

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    footer,
    onClose,
    title,
    visible,
  }: {
    children?: React.ReactNode;
    closeLabel?: string;
    footer?: React.ReactNode;
    onClose?: () => void;
    title: string;
    visible: boolean;
  }) =>
    visible ? (
      <div role="dialog">
        <span>{title}</span>
        <button
          aria-label={closeLabel}
          onClick={() => onClose?.()}
          type="button"
        />
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock('react-native', () => ({
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
  }) => (
    <button
      aria-label={accessibilityLabel}
      data-selected={accessibilityState?.selected}
      disabled={disabled}
      onClick={() => onPress?.()}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('StaffRoleSheet', () => {
  it('does not render when hidden', () => {
    render(
      <StaffRoleSheet
        colors={LIGHT_COLORS}
        isPending={false}
        onClose={vi.fn()}
        onRoleSelect={vi.fn()}
        onSubmit={vi.fn()}
        selectedRole="sales_rep"
        visible={false}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders roles, forwards selection, and submits the update', () => {
    const onRoleSelect = vi.fn();
    const onSubmit = vi.fn();

    render(
      <StaffRoleSheet
        colors={LIGHT_COLORS}
        isPending={false}
        onClose={vi.fn()}
        onRoleSelect={onRoleSelect}
        onSubmit={onSubmit}
        selectedRole="sales_rep"
        visible={true}
      />
    );

    expect(screen.getByText('Change Role')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('radio', { name: 'Select Administrator' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update role' }));

    expect(onRoleSelect).toHaveBeenCalledWith('admin');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables submit while the role update is pending', () => {
    render(
      <StaffRoleSheet
        colors={LIGHT_COLORS}
        isPending={true}
        onClose={vi.fn()}
        onRoleSelect={vi.fn()}
        onSubmit={vi.fn()}
        selectedRole="manager"
        visible={true}
      />
    );

    expect(screen.getByRole('button', { name: 'Update role' })).toBeDisabled();
    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });

  it('forwards sheet close actions', () => {
    const onClose = vi.fn();

    render(
      <StaffRoleSheet
        colors={LIGHT_COLORS}
        isPending={false}
        onClose={onClose}
        onRoleSelect={vi.fn()}
        onSubmit={vi.fn()}
        selectedRole="sales_rep"
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close role change sheet' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
