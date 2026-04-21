import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductFulfillmentSheet } from './ProductFulfillmentSheet';

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

describe('ProductFulfillmentSheet', () => {
  const colors = {
    border: '#e2e8f0',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  };

  it('renders fulfillment rows and reports field changes', () => {
    const onItemChange = vi.fn();

    render(
      <ProductFulfillmentSheet
        colors={colors}
        items={[
          { id: 'item-1', imei: '12345', serial_number: 'SN-1' },
          { id: 'item-2', imei: '', serial_number: '' },
        ]}
        onClose={vi.fn()}
        onDone={vi.fn()}
        onItemChange={onItemChange}
        stockQuantity={2}
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('IMEI for item 1'), {
      target: { value: '99999' },
    });

    expect(onItemChange).toHaveBeenCalledWith(0, 'imei', '99999');
    expect(screen.getByText('Enter details for 2 units')).toBeInTheDocument();
  });

  it('fires the shared done action from the footer', () => {
    const onDone = vi.fn();

    render(
      <ProductFulfillmentSheet
        colors={colors}
        items={[]}
        onClose={vi.fn()}
        onDone={onDone}
        onItemChange={vi.fn()}
        stockQuantity={0}
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Done editing fulfillment details' })
    );

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reports serial number field changes', () => {
    const onItemChange = vi.fn();

    render(
      <ProductFulfillmentSheet
        colors={colors}
        items={[{ id: 'item-1', imei: '', serial_number: 'SN-1' }]}
        onClose={vi.fn()}
        onDone={vi.fn()}
        onItemChange={onItemChange}
        stockQuantity={1}
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Serial number for item 1'), {
      target: { value: 'SN-99' },
    });

    expect(onItemChange).toHaveBeenCalledWith(0, 'serial_number', 'SN-99');
  });

  it('invokes onClose from the shared close control', () => {
    const onClose = vi.fn();

    render(
      <ProductFulfillmentSheet
        colors={colors}
        items={[]}
        onClose={onClose}
        onDone={vi.fn()}
        onItemChange={vi.fn()}
        stockQuantity={0}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when hidden', () => {
    render(
      <ProductFulfillmentSheet
        colors={colors}
        items={[]}
        onClose={vi.fn()}
        onDone={vi.fn()}
        onItemChange={vi.fn()}
        stockQuantity={0}
        visible={false}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Done editing fulfillment details' })
    ).not.toBeInTheDocument();
  });
});
