import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { BranchModal } from './BranchModal';

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
      accessibilityState?: { disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          disabled,
          onClick: onPress,
          role: accessibilityRole === 'button' ? accessibilityRole : undefined,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
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
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

function createProps(
  overrides: Partial<React.ComponentProps<typeof BranchModal>> = {}
): React.ComponentProps<typeof BranchModal> {
  return {
    visible: true,
    colors: LIGHT_COLORS,
    branchName: 'Lagos Main',
    onBranchNameChange: vi.fn(),
    branchCity: 'Lagos',
    onBranchCityChange: vi.fn(),
    isPending: false,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('BranchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when hidden', () => {
    render(<BranchModal {...createProps({ visible: false })} />);

    expect(screen.queryByText('Create Branch')).toBeNull();
  });

  it('renders the branch fields and supports editing and closing', () => {
    const props = createProps();

    render(<BranchModal {...props} />);

    expect(screen.getByRole('dialog', { name: 'Create branch' })).toBeTruthy();
    expect(screen.getByDisplayValue('Lagos Main')).toBeTruthy();
    expect(screen.getByDisplayValue('Lagos')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Branch name'), {
      target: { value: 'Abuja Branch' },
    });
    fireEvent.change(screen.getByLabelText('Branch city'), {
      target: { value: 'Abuja' },
    });
    fireEvent.click(screen.getByLabelText('Cancel branch creation'));

    expect(props.onBranchNameChange).toHaveBeenCalledWith('Abuja Branch');
    expect(props.onBranchCityChange).toHaveBeenCalledWith('Abuja');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('disables submission until a branch name exists', () => {
    const props = createProps({
      branchName: '   ',
    });

    render(<BranchModal {...props} />);

    expect(
      (
        screen.getByRole('button', {
          name: 'Create branch',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('submits when the form is valid', () => {
    const props = createProps();

    render(<BranchModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});
