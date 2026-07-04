import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ShipmentFlowDetailsStep } from './ShipmentFlowDetailsStep';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => (
    <span aria-label={name} role="img" />
  ),
  default: ({ name }: { name: string }) => (
    <span aria-label={name} role="img" />
  ),
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
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
        { 'aria-label': accessibilityLabel, onClick: onPress, type: 'button' },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      returnKeyType,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      returnKeyType?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'data-return-key-type': returnKeyType,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.currentTarget.value),
        placeholder,
        value,
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      backgroundLight: '#f8fafc',
      border: '#e2e8f0',
      primary: '#2563eb',
      text: '#0f172a',
      textSecondary: '#64748b',
    },
  }),
}));

describe('ShipmentFlowDetailsStep', () => {
  it('describes IMEI or serial number as the required shipment identifier', () => {
    render(
      <ShipmentFlowDetailsStep
        fulfillmentDetails={{ imei: '', items: [], serialNumber: '' }}
        fulfillmentItemIndex={0}
        hasExistingFulfillment={false}
        onFulfillmentDetailsChange={vi.fn()}
        onScanIdentifier={vi.fn()}
      />
    );

    expect(
      screen.getByText('IMEI or Serial Number is required for this order.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enter the device IMEI or serial number before this order is marked shipped.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('IMEI Number')).toBeInTheDocument();
    expect(screen.queryByText('IMEI Number *')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 353456789012345')).toHaveAttribute(
      'data-return-key-type',
      'done'
    );
    expect(screen.getByText('Serial Number')).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Optional serial number')
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. C02ZK0ABC123')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. C02ZK0ABC123')).toHaveAttribute(
      'data-return-key-type',
      'done'
    );
    expect(screen.getAllByText('Scan')).toHaveLength(2);
    expect(screen.getAllByLabelText('barcode-outline')).toHaveLength(3);
  });

  it('normalizes IMEI digits and uppercases serial number typing', () => {
    const onFulfillmentDetailsChange = vi.fn();

    render(
      <ShipmentFlowDetailsStep
        fulfillmentDetails={{ imei: '', items: [], serialNumber: '' }}
        fulfillmentItemIndex={0}
        hasExistingFulfillment={false}
        onFulfillmentDetailsChange={onFulfillmentDetailsChange}
        onScanIdentifier={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. 353456789012345'), {
      target: { value: 'abc353456789012345999' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. C02ZK0ABC123'), {
      target: { value: ' Bosnia sn-123/ab ' },
    });

    expect(onFulfillmentDetailsChange).toHaveBeenCalledWith(
      'imei',
      '353456789012345'
    );
    expect(onFulfillmentDetailsChange).toHaveBeenCalledWith(
      'serialNumber',
      'BOSNIASN-123AB'
    );
  });

  it('shows active device context and opens the scanner action', () => {
    const onScanIdentifier = vi.fn();

    render(
      <ShipmentFlowDetailsStep
        fulfillmentDetails={{
          imei: '',
          items: [
            {
              id: 'item-1:1',
              imei: '',
              orderItemId: 'item-1',
              productName: '13" iPad Air',
              serialNumber: '',
              unitCount: 1,
              unitIndex: 0,
            },
            {
              id: 'item-2:1',
              imei: '',
              orderItemId: 'item-2',
              productName: 'Apple Pencil Pro',
              serialNumber: '',
              unitCount: 1,
              unitIndex: 0,
            },
          ],
          serialNumber: '',
        }}
        fulfillmentItemIndex={1}
        hasExistingFulfillment={false}
        onFulfillmentDetailsChange={vi.fn()}
        onScanIdentifier={onScanIdentifier}
      />
    );

    expect(screen.getByText('Apple Pencil Pro')).toBeInTheDocument();
    expect(screen.getByText('Item 2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scan IMEI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Scan serial number' }));

    expect(onScanIdentifier).toHaveBeenCalledWith('imei');
    expect(onScanIdentifier).toHaveBeenCalledWith('serialNumber');
  });
});
