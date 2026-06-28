import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ShipmentFlowDetailsStep } from './ShipmentFlowDetailsStep';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
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
        fulfillmentDetails={{ imei: '', serialNumber: '' }}
        hasExistingFulfillment={false}
        onFulfillmentDetailsChange={vi.fn()}
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
  });

  it('normalizes IMEI digits and preserves serial number typing', () => {
    const onFulfillmentDetailsChange = vi.fn();

    render(
      <ShipmentFlowDetailsStep
        fulfillmentDetails={{ imei: '', serialNumber: '' }}
        hasExistingFulfillment={false}
        onFulfillmentDetailsChange={onFulfillmentDetailsChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. 353456789012345'), {
      target: { value: 'abc353456789012345999' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. C02ZK0ABC123'), {
      target: { value: ' SN-123 ' },
    });

    expect(onFulfillmentDetailsChange).toHaveBeenCalledWith(
      'imei',
      '353456789012345'
    );
    expect(onFulfillmentDetailsChange).toHaveBeenCalledWith(
      'serialNumber',
      ' SN-123 '
    );
  });
});
