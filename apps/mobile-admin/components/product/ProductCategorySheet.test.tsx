import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCategorySheet } from './ProductCategorySheet';

const nativeState = vi.hoisted(() => ({
  addNewStyle: null as unknown,
  appPageSheetProps: null as Record<string, unknown> | null,
}));

vi.mock('@/components/ui/AppPageSheet', async () => {
  const React = await import('react');
  return {
    AppPageSheet: ({ children, ...props }: Record<string, unknown>) => {
      nativeState.appPageSheetProps = props;
      if (!props.visible) return null;
      return React.createElement(
        'section',
        { 'aria-label': 'Product category drawer' },
        React.createElement('h2', null, String(props.title)),
        React.createElement(
          'button',
          {
            'aria-label': String(props.closeLabel),
            onClick: props.onClose as () => void,
            type: 'button',
          },
          'Close'
        ),
        children as React.ReactNode
      );
    },
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Modal: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
      style,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      style?: unknown;
    }) => {
      if (accessibilityLabel === 'Add new category') {
        nativeState.addNewStyle = style;
      }
      return React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      );
    },
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

  beforeEach(() => {
    nativeState.addNewStyle = null;
    nativeState.appPageSheetProps = null;
  });

  it('uses a bottom drawer with a full-width Add New action', () => {
    render(
      <ProductCategorySheet
        categories={[]}
        colors={colors}
        isCreating={false}
        isSubmittingNewCategory={false}
        newCategoryName=""
        onClose={vi.fn()}
        onCreateCategory={vi.fn()}
        onNewCategoryNameChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleCreateMode={vi.fn()}
        selectedCategoryId=""
        visible
      />
    );

    expect(
      screen.getByRole('region', { name: 'Product category drawer' })
    ).toBeInTheDocument();
    expect(screen.getByText('Select Category')).toBeInTheDocument();
    expect(nativeState.appPageSheetProps).toMatchObject({
      closeLabel: 'Close category sheet',
      scrollEnabled: true,
      title: 'Select Category',
      visible: true,
    });
    expect(nativeState.addNewStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ minHeight: 52, width: '100%' }),
      ])
    );
  });

  it('routes close behavior through the shared sheet', () => {
    const onClose = vi.fn();
    render(
      <ProductCategorySheet
        categories={[]}
        colors={colors}
        isCreating={false}
        isSubmittingNewCategory={false}
        newCategoryName=""
        onClose={onClose}
        onCreateCategory={vi.fn()}
        onNewCategoryNameChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleCreateMode={vi.fn()}
        selectedCategoryId=""
        visible
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close category sheet' })
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when not visible', () => {
    render(
      <ProductCategorySheet
        categories={[]}
        colors={colors}
        isCreating={false}
        isSubmittingNewCategory={false}
        newCategoryName=""
        onClose={vi.fn()}
        onCreateCategory={vi.fn()}
        onNewCategoryNameChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleCreateMode={vi.fn()}
        selectedCategoryId=""
        visible={false}
      />
    );

    expect(
      screen.queryByRole('region', { name: 'Product category drawer' })
    ).not.toBeInTheDocument();
  });

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

  it('disables the Create category button while submission is in progress', () => {
    render(
      <ProductCategorySheet
        categories={[]}
        colors={colors}
        isCreating={true}
        isSubmittingNewCategory={true}
        newCategoryName="Accessories"
        onClose={vi.fn()}
        onCreateCategory={vi.fn()}
        onNewCategoryNameChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleCreateMode={vi.fn()}
        selectedCategoryId=""
        visible={true}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Create category' })
    ).toBeDisabled();
  });
});
