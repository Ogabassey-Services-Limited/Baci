import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { InviteStaffSheet } from './InviteStaffSheet';

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    accessibilityLabel,
    children,
    onClose,
    visible,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onClose?: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <div aria-label={accessibilityLabel} role="dialog">
        <button
          aria-label="Close sheet"
          onClick={() => onClose?.()}
          type="button"
        />
        {children}
      </div>
    ) : null,
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Animated: {
    Value: class {
      constructor(public value: number) {}
    },
    spring: () => ({
      start: () => undefined,
    }),
    View: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  TextInput: ({
    accessibilityLabel,
    autoCapitalize,
    autoComplete,
    importantForAutofill,
    onChangeText,
    textContentType,
    value,
  }: {
    accessibilityLabel?: string;
    autoCapitalize?: string;
    autoComplete?: string;
    importantForAutofill?: string;
    onChangeText?: (text: string) => void;
    textContentType?: string;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      data-important-for-autofill={importantForAutofill}
      data-text-content-type={textContentType}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('InviteStaffSheet', () => {
  it('does not render when hidden', () => {
    render(
      <InviteStaffSheet
        autoCreateAccount={true}
        colors={LIGHT_COLORS}
        inviteEmail=""
        inviteName=""
        isPending={false}
        onClose={vi.fn()}
        onEmailChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
        onToggleAutoCreateAccount={vi.fn()}
        visible={false}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('forwards field edits, toggle, and submit actions', () => {
    const onEmailChange = vi.fn();
    const onNameChange = vi.fn();
    const onSubmit = vi.fn();
    const onToggleAutoCreateAccount = vi.fn();

    render(
      <InviteStaffSheet
        autoCreateAccount={true}
        colors={LIGHT_COLORS}
        inviteEmail="ada@example.com"
        inviteName="Ada"
        isPending={false}
        onClose={vi.fn()}
        onEmailChange={onEmailChange}
        onNameChange={onNameChange}
        onSubmit={onSubmit}
        onToggleAutoCreateAccount={onToggleAutoCreateAccount}
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Invite email'), {
      target: { value: 'kola@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Invite name'), {
      target: { value: 'Kola' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate staff account' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(onEmailChange).toHaveBeenCalledWith('kola@example.com');
    expect(onNameChange).toHaveBeenCalledWith('Kola');
    expect(onToggleAutoCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('exposes autofill metadata for invite name and email inputs', () => {
    render(
      <InviteStaffSheet
        autoCreateAccount={true}
        colors={LIGHT_COLORS}
        inviteEmail="ada@example.com"
        inviteName="Ada"
        isPending={false}
        onClose={vi.fn()}
        onEmailChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
        onToggleAutoCreateAccount={vi.fn()}
        visible={true}
      />
    );

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
  });

  it('disables submit when email is empty', () => {
    render(
      <InviteStaffSheet
        autoCreateAccount={false}
        colors={LIGHT_COLORS}
        inviteEmail=""
        inviteName=""
        isPending={false}
        onClose={vi.fn()}
        onEmailChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
        onToggleAutoCreateAccount={vi.fn()}
        visible={true}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Send invitation' })
    ).toBeDisabled();
  });

  it('shows the pending state and disables submit while invite creation is running', () => {
    render(
      <InviteStaffSheet
        autoCreateAccount={true}
        colors={LIGHT_COLORS}
        inviteEmail="ada@example.com"
        inviteName="Ada"
        isPending={true}
        onClose={vi.fn()}
        onEmailChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
        onToggleAutoCreateAccount={vi.fn()}
        visible={true}
      />
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Send invitation' })
    ).toBeDisabled();
  });

  it('forwards close actions from both the sheet shell and the close button', () => {
    const onClose = vi.fn();

    render(
      <InviteStaffSheet
        autoCreateAccount={false}
        colors={LIGHT_COLORS}
        inviteEmail="ada@example.com"
        inviteName=""
        isPending={false}
        onClose={onClose}
        onEmailChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
        onToggleAutoCreateAccount={vi.fn()}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Close invite team member sheet' })
    );

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
