import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CreateCategoryModal } from './CreateCategoryModal';

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
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible: boolean;
    }) => (visible ? React.createElement('div', null, children) : null),
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
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      absoluteFill: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      onSubmitEditing,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      onSubmitEditing?: () => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            onSubmitEditing?.();
          }
        },
        value: value ?? '',
      }),
    useColorScheme: () => 'light',
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('CreateCategoryModal', () => {
  const defaultProps = {
    isSubmitting: false,
    name: '',
    onChangeName: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    visible: true,
  };

  it('renders the title and the category name input when visible', () => {
    render(<CreateCategoryModal {...defaultProps} />);

    expect(screen.getByText('Create Category')).toBeTruthy();
    expect(screen.getByLabelText('Category name')).toBeTruthy();
  });

  it('does not render modal content when not visible', () => {
    render(<CreateCategoryModal {...defaultProps} visible={false} />);

    expect(screen.queryByText('Create Category')).toBeNull();
  });

  it('calls onChangeName as the user types a category name', () => {
    const onChangeName = vi.fn();

    render(<CreateCategoryModal {...defaultProps} onChangeName={onChangeName} />);

    fireEvent.change(screen.getByLabelText('Category name'), {
      target: { value: 'Electronics' },
    });

    expect(onChangeName).toHaveBeenCalledWith('Electronics');
  });

  it('calls onClose when Cancel is pressed', () => {
    const onClose = vi.fn();

    render(<CreateCategoryModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables the Create button when the name is empty', () => {
    render(<CreateCategoryModal {...defaultProps} name="" />);

    expect(
      screen.getByRole('button', { name: 'Create category' })
    ).toBeDisabled();
  });

  it('disables the Create button when the name is only whitespace', () => {
    render(<CreateCategoryModal {...defaultProps} name="   " />);

    expect(
      screen.getByRole('button', { name: 'Create category' })
    ).toBeDisabled();
  });

  it('disables the Create button while a submission is in progress', () => {
    render(
      <CreateCategoryModal {...defaultProps} isSubmitting={true} name="Shoes" />
    );

    expect(
      screen.getByRole('button', { name: 'Creating category' })
    ).toBeDisabled();
  });

  it('calls onSubmit when Create is pressed with a valid name', () => {
    const onSubmit = vi.fn();

    render(
      <CreateCategoryModal {...defaultProps} name="Shoes" onSubmit={onSubmit} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('guards keyboard submit with the same disabled rules as the button', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CreateCategoryModal
        {...defaultProps}
        name="   "
        onSubmit={onSubmit}
      />
    );

    fireEvent.keyDown(screen.getByLabelText('Category name'), {
      key: 'Enter',
    });
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <CreateCategoryModal
        {...defaultProps}
        isSubmitting={true}
        name="Shoes"
        onSubmit={onSubmit}
      />
    );
    fireEvent.keyDown(screen.getByLabelText('Category name'), {
      key: 'Enter',
    });
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <CreateCategoryModal
        {...defaultProps}
        name="Shoes"
        onSubmit={onSubmit}
      />
    );
    fireEvent.keyDown(screen.getByLabelText('Category name'), {
      key: 'Enter',
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a "Creating category" label and spinner while submitting', () => {
    render(
      <CreateCategoryModal {...defaultProps} isSubmitting={true} name="Shoes" />
    );

    expect(
      screen.getByRole('button', { name: 'Creating category' })
    ).toBeTruthy();
    expect(screen.getByText('loading')).toBeTruthy();
  });
});
