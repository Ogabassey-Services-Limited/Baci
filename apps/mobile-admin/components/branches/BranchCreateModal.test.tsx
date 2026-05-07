import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BranchCreateModal } from './BranchCreateModal';

let lastModalOnRequestClose: (() => void) | undefined;

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
  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Modal: ({
      children,
      onRequestClose,
      visible,
    }: {
      children?: React.ReactNode;
      onRequestClose?: () => void;
      visible: boolean;
    }) => {
      lastModalOnRequestClose = onRequestClose;
      return visible ? React.createElement('div', null, children) : null;
    },
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
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value,
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

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

describe('BranchCreateModal', () => {
  const defaultProps = {
    visible: true,
    onClose: vi.fn(),
    branchName: 'Lagos main',
    setBranchName: vi.fn(),
    branchAddress: '',
    setBranchAddress: vi.fn(),
    nameError: '',
    setNameError: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
    colors,
  };

  it('renders branch inputs and submits from the primary action', () => {
    const onSubmit = vi.fn();

    render(<BranchCreateModal {...defaultProps} onSubmit={onSubmit} />);

    expect(screen.getAllByText('Create Branch')).toHaveLength(2);
    expect(screen.getByLabelText('Branch name input')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables the primary action while branch creation is loading', () => {
    render(<BranchCreateModal {...defaultProps} isLoading={true} />);

    expect(
      screen.getByRole('button', { name: 'Creating branch' })
    ).toBeDisabled();
    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('renders the branch name error', () => {
    render(
      <BranchCreateModal
        {...defaultProps}
        nameError="Branch name is required"
      />
    );

    expect(screen.getByText('Branch name is required')).toBeTruthy();
  });

  it('does not render modal content when hidden', () => {
    render(<BranchCreateModal {...defaultProps} visible={false} />);

    expect(screen.queryByText('Create Branch')).toBeNull();
  });

  it('calls onClose from the close control', () => {
    const onClose = vi.fn();

    render(<BranchCreateModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Close create branch modal' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not wire hardware-close while branch creation is loading', () => {
    render(<BranchCreateModal {...defaultProps} isLoading={true} />);

    expect(lastModalOnRequestClose).toBeUndefined();
  });
});
