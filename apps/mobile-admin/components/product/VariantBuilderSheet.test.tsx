import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { VariantBuilderSheet } from './VariantBuilderSheet';

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    footer,
  }: {
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

vi.mock('./VariantOptionGroupEditor', () => ({
  VariantOptionGroupEditor: ({
    index,
    onAddValue,
    onChangeName,
  }: {
    index: number;
    onAddValue: (value: string) => void;
    onChangeName: (name: string) => void;
  }) => (
    <div>
      <button
        aria-label={`set-name-${index}`}
        onClick={() => onChangeName('Color')}
        type="button"
      />
      <button
        aria-label={`add-value-${index}`}
        onClick={() => onAddValue('Black')}
        type="button"
      />
      <button
        aria-label={`add-second-value-${index}`}
        onClick={() => onAddValue('White')}
        type="button"
      />
      <button
        aria-label={`add-many-values-${index}`}
        onClick={() => {
          for (let optionIndex = 0; optionIndex < 101; optionIndex += 1) {
            onAddValue(`Value ${optionIndex}`);
          }
        }}
        type="button"
      />
    </div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
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
      accessibilityState?: { checked?: boolean; disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-label': accessibilityLabel,
          disabled: disabled ?? accessibilityState?.disabled,
          onClick: () => onPress?.(),
          role: accessibilityRole,
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('VariantBuilderSheet', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  const defaults = { costPrice: 0, images: [] as string[], price: 1000 };

  it('disables generation and shows a nudge when no options are configured', () => {
    const onGenerate = vi.fn();

    render(
      <VariantBuilderSheet
        colors={colors}
        defaults={defaults}
        initialConditions={[]}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        visible={true}
      />
    );

    expect(screen.getByText('Add options to continue')).toBeInTheDocument();

    const generateButton = screen.getByRole('button', {
      name: 'Add options to continue',
    });
    expect(generateButton).toBeDisabled();

    fireEvent.click(generateButton);

    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('generates a variant per value combination and closes the sheet', () => {
    const onClose = vi.fn();
    const onGenerate = vi.fn();

    render(
      <VariantBuilderSheet
        colors={colors}
        defaults={defaults}
        initialConditions={[]}
        onClose={onClose}
        onGenerate={onGenerate}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-name-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-value-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-second-value-0' }));

    const generateButton = screen.getByRole('button', {
      name: 'Generate 2 variants',
    });
    expect(generateButton).not.toBeDisabled();
    expect(screen.getByText('Generate 2 variants')).toBeInTheDocument();

    fireEvent.click(generateButton);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const generatedVariants = onGenerate.mock.calls[0]?.[0] as
      | EditableProductVariant[]
      | undefined;
    expect(generatedVariants).toHaveLength(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('increases the combination count when a condition chip is selected', () => {
    render(
      <VariantBuilderSheet
        colors={colors}
        defaults={defaults}
        initialConditions={[]}
        onClose={vi.fn()}
        onGenerate={vi.fn()}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'New condition' }));

    expect(
      screen.getByRole('button', { name: 'Generate 1 variant' })
    ).toBeInTheDocument();
    expect(screen.getByText('Generate 1 variant')).toBeInTheDocument();
  });

  it('does not call onGenerate when the sheet is closed via the add-option affordance alone', () => {
    const onGenerate = vi.fn();

    render(
      <VariantBuilderSheet
        colors={colors}
        defaults={defaults}
        initialConditions={[]}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add another option' }));

    expect(screen.getAllByRole('button', { name: /^set-name-/ })).toHaveLength(
      2
    );
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('requires a condition before generating when existing variants use conditions', () => {
    const onGenerate = vi.fn();

    render(
      <VariantBuilderSheet
        colors={colors}
        conditionMode="required"
        defaults={defaults}
        initialConditions={[]}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-name-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-value-0' }));

    // Options are set but no condition chosen → generation is blocked.
    expect(
      screen.getByText('Select a condition to continue')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Select a condition to continue'));
    expect(onGenerate).not.toHaveBeenCalled();

    // Choosing a condition unblocks it.
    fireEvent.click(screen.getByRole('checkbox', { name: 'New condition' }));
    fireEvent.click(screen.getByText('Generate 1 variant'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('hides the condition chips when existing variants have no condition', () => {
    const onGenerate = vi.fn();

    render(
      <VariantBuilderSheet
        colors={colors}
        conditionMode="blocked"
        defaults={defaults}
        initialConditions={[]}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        visible={true}
      />
    );

    expect(
      screen.getByText(/do not use conditions, so new ones cannot/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'New condition' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'set-name-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-value-0' }));
    fireEvent.click(screen.getByText('Generate 1 variant'));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const generated = onGenerate.mock.calls[0]?.[0] as
      | EditableProductVariant[]
      | undefined;
    expect(generated?.every((variant) => !variant.condition)).toBe(true);
  });

  it('disables generation when the combination count is over the limit', () => {
    const onGenerate = vi.fn();

    render(
      <VariantBuilderSheet
        colors={colors}
        defaults={defaults}
        initialConditions={[]}
        onClose={vi.fn()}
        onGenerate={onGenerate}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-name-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-many-values-0' }));

    expect(screen.getByText(/more than the 100/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove some values to continue' })
    ).toBeDisabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('resets the draft options when reopened', () => {
    const props = {
      colors,
      defaults,
      initialConditions: [],
      onClose: vi.fn(),
      onGenerate: vi.fn(),
      visible: true,
    };
    const { rerender } = render(<VariantBuilderSheet {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'set-name-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-value-0' }));
    expect(screen.getByText('Generate 1 variant')).toBeInTheDocument();

    rerender(<VariantBuilderSheet {...props} visible={false} />);
    rerender(<VariantBuilderSheet {...props} visible={true} />);

    expect(screen.getByText('Add options to continue')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add options to continue' })
    ).toBeDisabled();
  });
});
