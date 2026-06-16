import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductRestockSheet } from './ProductRestockSheet';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useBranches: vi.fn(() => ({ data: [] as Record<string, unknown>[] })),
  alert: vi.fn(),
}));

vi.mock('@/hooks/useBranches', () => ({
  useBranches: mocks.useBranches,
}));

vi.mock('@/hooks/useVariantInventory', () => ({
  useRestockVariantInventory: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    footer,
    onClose,
    title,
    visible,
  }: {
    children?: React.ReactNode;
    footer?: React.ReactNode;
    onClose: () => void;
    title: string;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label={title}>
        <button aria-label="Close sheet" onClick={onClose} type="button" />
        {children}
        {footer}
      </section>
    ) : null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: {
      alert: mocks.alert,
    },
    Platform: {
      OS: 'ios',
      select<T>(objs: { ios?: T; android?: T; default?: T }) {
        return objs.ios ?? objs.default;
      },
    },
    ActivityIndicator: () => null,
    StatusBar: () => null,
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      disabled,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
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
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
      multiline,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
      multiline?: boolean;
    }) =>
      React.createElement(multiline ? 'textarea' : 'input', {
        'aria-label': accessibilityLabel,
        placeholder,
        value: value ?? '',
        onChange: (
          event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ProductRestockSheet', () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.mutateAsync.mockReset();
    mocks.useBranches.mockReset();
    mocks.useBranches.mockReturnValue({ data: [] });
  });

  const colors = {
    border: '#e2e8f0',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
    background: '#ffffff',
    card: '#ffffff',
    error: '#ef4444',
  } as unknown as ThemeColors;

  it('renders restock form options and handles input parsing and submission', () => {
    mocks.useBranches.mockReturnValue({
      data: [
        { id: 'branch-1', name: 'Branch A' },
        { id: 'branch-2', name: 'Branch B' },
      ],
    });
    const onClose = vi.fn();

    render(
      <ProductRestockSheet
        colors={colors}
        productId="product-1"
        variantId="variant-1"
        onClose={onClose}
        visible={true}
      />
    );

    // Assert that titles exist
    expect(screen.getByText('Identifier Type')).toBeInTheDocument();
    expect(screen.getByText('Enter IMEIs')).toBeInTheDocument();

    // Type 2 valid IMEIs
    const textInput = screen.getByLabelText('Identifiers text list');
    fireEvent.change(textInput, {
      target: { value: '123456789012345\n987654321098765' },
    });

    // Select branch B
    const branchB = screen.getByLabelText('Assign to Branch B');
    fireEvent.click(branchB);

    // Select Dropship source
    const dropshipSource = screen.getByLabelText('Select source Dropship');
    fireEvent.click(dropshipSource);

    // Click Restock
    const submitBtn = screen.getByLabelText('Submit restock');
    fireEvent.click(submitBtn);

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      productId: 'product-1',
      variantId: 'variant-1',
      units: [
        { imei: '123456789012345', source: 'dropship', notes: undefined },
        { imei: '987654321098765', source: 'dropship', notes: undefined },
      ],
      branchId: 'branch-2',
    });
  });

  it('treats delimiter-only input as an empty restock submission', () => {
    render(
      <ProductRestockSheet
        colors={colors}
        productId="product-1"
        onClose={vi.fn()}
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Identifiers text list'), {
      target: { value: ',,\n  ,' },
    });

    const submitButton = screen.getByLabelText('Submit restock');
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);

    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('validates invalid IMEI shapes', () => {
    mocks.useBranches.mockReturnValue({ data: [] });
    render(
      <ProductRestockSheet
        colors={colors}
        productId="product-1"
        onClose={vi.fn()}
        visible={true}
      />
    );

    const textInput = screen.getByLabelText('Identifiers text list');
    fireEvent.change(textInput, {
      target: { value: '12345\n987654321098765' },
    });

    const submitBtn = screen.getByLabelText('Submit restock');
    fireEvent.click(submitBtn);

    // Alert should be called because "12345" is not a 15-digit IMEI
    expect(mocks.alert).toHaveBeenCalled();
  });
});
