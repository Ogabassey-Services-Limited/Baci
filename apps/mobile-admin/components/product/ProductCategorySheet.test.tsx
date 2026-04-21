import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductCategorySheet } from './ProductCategorySheet';

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

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
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

describe('ProductCategorySheet', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textSecondary: '#64748b',
    textOnPrimary: '#ffffff',
  };

  it('renders categories and selects one', () => {
    const onSelect = vi.fn();

    render(
      <ProductCategorySheet
        categories={[
          { id: 'phones', name: 'Phones' },
          { id: 'tablets', name: 'Tablets' },
        ]}
        colors={colors}
        isCreating={false}
        isSubmittingNewCategory={false}
        newCategoryName=""
        onClose={vi.fn()}
        onCreateCategory={vi.fn()}
        onNewCategoryNameChange={vi.fn()}
        onSelect={onSelect}
        onToggleCreateMode={vi.fn()}
        selectedCategoryId="phones"
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Tablets' }));

    expect(onSelect).toHaveBeenCalledWith({ id: 'tablets', name: 'Tablets' });
  });

  it('allows entering a new category name and creating it', () => {
    const onNewCategoryNameChange = vi.fn();
    const onCreateCategory = vi.fn();

    render(
      <ProductCategorySheet
        categories={[]}
        colors={colors}
        isCreating={true}
        isSubmittingNewCategory={false}
        newCategoryName="Accessories"
        onClose={vi.fn()}
        onCreateCategory={onCreateCategory}
        onNewCategoryNameChange={onNewCategoryNameChange}
        onSelect={vi.fn()}
        onToggleCreateMode={vi.fn()}
        selectedCategoryId=""
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('New category name'), {
      target: { value: 'Wearables' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));

    expect(onNewCategoryNameChange).toHaveBeenCalledWith('Wearables');
    expect(onCreateCategory).toHaveBeenCalledTimes(1);
  });
});
