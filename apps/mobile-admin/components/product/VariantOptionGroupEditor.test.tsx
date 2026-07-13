import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { VariantOptionGroupEditor } from './VariantOptionGroupEditor';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
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
      onChangeText?: (value: string) => void;
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

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('VariantOptionGroupEditor', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    primaryLight: '#dbeafe',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('commits a typed value when the confirm button is pressed', () => {
    const onAddValue = vi.fn();

    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={onAddValue}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{ id: 'o1', name: '', values: [] }}
      />
    );

    fireEvent.change(screen.getByLabelText('Add value to Option 1'), {
      target: { value: 'Black' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm value for Option 1' })
    );

    expect(onAddValue).toHaveBeenCalledWith('Black');
  });

  it('does not add a value when the draft is blank', () => {
    const onAddValue = vi.fn();

    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={onAddValue}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{ id: 'o1', name: '', values: [] }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm value for Option 1' })
    );

    expect(onAddValue).not.toHaveBeenCalled();
  });

  it('does not add duplicate values for the same option', () => {
    const onAddValue = vi.fn();

    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={onAddValue}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{
          id: 'o1',
          name: 'Color',
          values: [{ id: 'v1', value: 'Black' }],
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('Add value to Color'), {
      target: { value: 'black' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm value for Color' })
    );

    expect(onAddValue).not.toHaveBeenCalled();
  });

  it('sets the option name when a suggestion chip is pressed', () => {
    const onChangeName = vi.fn();

    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={vi.fn()}
        onChangeName={onChangeName}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{ id: 'o1', name: '', values: [] }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Name option 1 Color' })
    );

    expect(onChangeName).toHaveBeenCalledWith('Color');
  });

  it('hides suggestion chips once a name has been entered', () => {
    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={vi.fn()}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{ id: 'o1', name: 'Color', values: [] }}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Name option 1 Color' })
    ).toBeNull();
  });

  it('removes a value when its remove control is pressed', () => {
    const onRemoveValue = vi.fn();

    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={vi.fn()}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={onRemoveValue}
        option={{
          id: 'o1',
          name: 'Color',
          values: [{ id: 'v1', value: 'Black' }],
        }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Black from Color' })
    );

    expect(onRemoveValue).toHaveBeenCalledWith('v1');
  });

  it('renders no value chips when the option has no values', () => {
    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={vi.fn()}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{ id: 'o1', name: 'Color', values: [] }}
      />
    );

    expect(screen.queryByText(/Remove .* from Color/)).toBeNull();
  });

  it('removes the option when the remove-option button is pressed', () => {
    const onRemoveOption = vi.fn();

    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={0}
        onAddValue={vi.fn()}
        onChangeName={vi.fn()}
        onRemoveOption={onRemoveOption}
        onRemoveValue={vi.fn()}
        option={{ id: 'o1', name: '', values: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove option 1' }));

    expect(onRemoveOption).toHaveBeenCalledTimes(1);
  });

  it('falls back to a positional label when the option name is blank', () => {
    render(
      <VariantOptionGroupEditor
        colors={colors}
        index={2}
        onAddValue={vi.fn()}
        onChangeName={vi.fn()}
        onRemoveOption={vi.fn()}
        onRemoveValue={vi.fn()}
        option={{ id: 'o3', name: '   ', values: [] }}
      />
    );

    expect(screen.getByLabelText('Add value to Option 3')).toBeInTheDocument();
  });
});
