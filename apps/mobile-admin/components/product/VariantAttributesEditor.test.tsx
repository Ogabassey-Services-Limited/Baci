import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { VariantAttributeFormValue } from '@/lib/product-variant-form';
import { VariantAttributesEditor } from './VariantAttributesEditor';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
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
      hairlineWidth: 1,
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
        'aria-label': accessibilityLabel ?? placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
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

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  error: '#dc2626',
  inputBg: '#f8fafc',
  primary: '#2563eb',
  text: '#0f172a',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

function renderEditor(attributes: VariantAttributeFormValue[]) {
  const handlers = {
    onAddAttribute: vi.fn(),
    onRemoveAttribute: vi.fn(),
    onUpdateAttribute: vi.fn(),
  };
  render(
    <VariantAttributesEditor
      attributes={attributes}
      colors={colors}
      onAddAttribute={handlers.onAddAttribute}
      onRemoveAttribute={handlers.onRemoveAttribute}
      onUpdateAttribute={handlers.onUpdateAttribute}
      variantIndex={0}
    />
  );
  return handlers;
}

describe('VariantAttributesEditor', () => {
  it('hides machine attributes like color_hex but maps edits to their real index', () => {
    renderEditor([
      { id: 'a1', key: 'color', value: 'Black' },
      { id: 'a2', key: 'color_hex', value: '#1C1C1C' },
      { id: 'a3', key: 'storage', value: '128GB' },
    ]);

    // color_hex (real index 1) is never rendered as an editable row.
    expect(
      screen.queryByLabelText('Attribute key for variant 1 item 2')
    ).not.toBeInTheDocument();

    // The visible rows keep their real indexes (0 and 2), not their display
    // position, so callbacks target the right entry in the full array.
    expect(
      screen.getByLabelText('Attribute key for variant 1 item 1')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Attribute key for variant 1 item 3')
    ).toBeInTheDocument();
  });

  it('calls onUpdateAttribute with the real index when a visible value changes', () => {
    const handlers = renderEditor([
      { id: 'a1', key: 'color', value: 'Black' },
      { id: 'a2', key: 'color_hex', value: '#1C1C1C' },
      { id: 'a3', key: 'storage', value: '128GB' },
    ]);

    fireEvent.change(
      screen.getByLabelText('Attribute value for variant 1 item 3'),
      { target: { value: '256GB' } }
    );

    expect(handlers.onUpdateAttribute).toHaveBeenCalledWith(2, 'value', '256GB');
  });

  it('shows an empty prompt and adds a detail row on request', () => {
    const handlers = renderEditor([]);

    expect(
      screen.getByText(/Add what makes this variant unique/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add detail to variant 1' })
    );

    expect(handlers.onAddAttribute).toHaveBeenCalledTimes(1);
  });

  it('offers key suggestions when a row has no key yet', () => {
    const handlers = renderEditor([{ id: 'blank', key: '', value: '' }]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Use Color for variant 1 item 1' })
    );

    expect(handlers.onUpdateAttribute).toHaveBeenCalledWith(0, 'key', 'Color');
  });

  it('removes stale color_hex metadata when a colour key is renamed away', () => {
    const handlers = renderEditor([
      { id: 'a1', key: 'color', value: 'Black' },
      { id: 'a2', key: 'color_hex', value: '#000000' },
      { id: 'a3', key: 'storage', value: '128GB' },
    ]);

    fireEvent.change(
      screen.getByLabelText('Attribute key for variant 1 item 1'),
      { target: { value: 'Finish' } }
    );

    expect(handlers.onUpdateAttribute).toHaveBeenCalledWith(0, 'key', 'Finish');
    expect(handlers.onRemoveAttribute).toHaveBeenCalledTimes(1);
    expect(handlers.onRemoveAttribute).toHaveBeenCalledWith(1);
  });

  it('removes a visible attribute by its real index', () => {
    const handlers = renderEditor([
      { id: 'a1', key: 'storage', value: '128GB' },
    ]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove variant 1 attribute 1' })
    );

    expect(handlers.onRemoveAttribute).toHaveBeenCalledWith(0);
  });

  it('removes the paired color_hex when its colour attribute is removed', () => {
    const handlers = renderEditor([
      { id: 'a1', key: 'color', value: 'Black' },
      { id: 'a2', key: 'color_hex', value: '#000000' },
      { id: 'a3', key: 'storage', value: '128GB' },
    ]);

    // The colour row is visible item 1 (real index 0).
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove variant 1 attribute 1' })
    );

    // Both the colour (0) and its hex (1) are removed, highest index first so
    // each splice stays valid.
    expect(handlers.onRemoveAttribute).toHaveBeenCalledTimes(2);
    expect(handlers.onRemoveAttribute).toHaveBeenNthCalledWith(1, 1);
    expect(handlers.onRemoveAttribute).toHaveBeenNthCalledWith(2, 0);
  });
});
