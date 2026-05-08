import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchEditModal } from './BranchEditModal';

const colors = {
  background: '#fff',
  border: '#ddd',
  card: '#fff',
  notification: '#f00',
  primary: '#2563eb',
  text: '#111',
  textMuted: '#777',
  textOnPrimary: '#fff',
  textSecondary: '#555',
};

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
  };
});

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
  const TextInput = React.forwardRef(
    (
      {
        accessibilityLabel,
        editable,
        onChangeText,
        onSubmitEditing,
        value,
      }: {
        accessibilityLabel?: string;
        editable?: boolean;
        onChangeText?: (text: string) => void;
        onSubmitEditing?: () => void;
        value?: string;
      },
      ref: React.ForwardedRef<{ focus: () => void }>
    ) => {
      const inputRef = React.useRef<HTMLInputElement>(null);
      React.useImperativeHandle(
        ref,
        () => ({
          focus: () => inputRef.current?.focus(),
        }),
        []
      );

      return React.createElement('input', {
        'aria-label': accessibilityLabel,
        disabled: editable === false,
        ref: inputRef,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            onSubmitEditing?.();
          }
        },
      });
    }
  );
  TextInput.displayName = 'TextInput';

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
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
          onClick: onPress,
          role: accessibilityRole === 'button' ? 'button' : undefined,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput,
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

function createProps(
  overrides: Partial<React.ComponentProps<typeof BranchEditModal>> = {}
): React.ComponentProps<typeof BranchEditModal> {
  return {
    visible: true,
    branchName: 'Lagos main',
    setBranchName: vi.fn(),
    branchAddress: '12 Broad Street',
    setBranchAddress: vi.fn(),
    nameError: '',
    setNameError: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onDeactivate: vi.fn(),
    isUpdating: false,
    isDeactivating: false,
    canDeactivate: true,
    colors,
    ...overrides,
  };
}

describe('BranchEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when hidden', () => {
    render(<BranchEditModal {...createProps({ visible: false })} />);

    expect(screen.queryByText('Edit Branch')).not.toBeInTheDocument();
  });

  it('edits branch fields and submits changes', () => {
    const props = createProps();

    render(<BranchEditModal {...props} />);

    fireEvent.change(screen.getByLabelText('Branch name input'), {
      target: { value: 'Lekki main' },
    });
    fireEvent.change(screen.getByLabelText('Branch address input'), {
      target: { value: '15 Admiralty Way' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save branch' }));

    expect(props.setBranchName).toHaveBeenCalledWith('Lekki main');
    expect(props.setBranchAddress).toHaveBeenCalledWith('15 Admiralty Way');
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables deactivation when it would remove the only active branch', () => {
    const props = createProps({ canDeactivate: false });
    render(<BranchEditModal {...props} />);

    const deactivateButton = screen.getByRole('button', {
      name: 'Deactivate branch',
    });
    expect(deactivateButton).toBeDisabled();

    fireEvent.click(deactivateButton);

    expect(props.onDeactivate).not.toHaveBeenCalled();
  });

  it('shows validation and loading states', () => {
    const { rerender } = render(
      <BranchEditModal {...createProps({ nameError: 'Name is required' })} />
    );

    expect(screen.getByText('Name is required')).toBeInTheDocument();

    rerender(<BranchEditModal {...createProps({ isUpdating: true })} />);

    expect(
      screen.getByRole('button', { name: 'Saving branch' })
    ).toBeDisabled();
    expect(screen.getByText('loading')).toBeInTheDocument();

    rerender(<BranchEditModal {...createProps({ isDeactivating: true })} />);

    expect(
      screen.getByRole('button', { name: 'Deactivate branch' })
    ).toBeDisabled();
  });

  it('calls close from the header close control', () => {
    const props = createProps();

    render(<BranchEditModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close edit modal' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('locks editable fields while a branch mutation is busy', () => {
    render(<BranchEditModal {...createProps({ isUpdating: true })} />);

    expect(screen.getByLabelText('Branch name input')).toBeDisabled();
    expect(screen.getByLabelText('Branch address input')).toBeDisabled();
  });

  it('moves focus from branch name to address on submit', () => {
    render(<BranchEditModal {...createProps()} />);

    fireEvent.keyDown(screen.getByLabelText('Branch name input'), {
      key: 'Enter',
    });

    expect(screen.getByLabelText('Branch address input')).toHaveFocus();
  });

  it('calls deactivate when allowed', () => {
    const props = createProps();

    render(<BranchEditModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate branch' }));

    expect(props.onDeactivate).toHaveBeenCalledTimes(1);
  });
});
