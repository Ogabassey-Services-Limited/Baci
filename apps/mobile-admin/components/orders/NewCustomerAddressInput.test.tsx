import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { NewCustomerAddressInput } from './NewCustomerAddressInput';

type GooglePlacesProps = {
  onPress?: (data: { description: string }) => void;
  placeholder?: string;
  query?: { components?: string; key?: string; language?: string };
  textInputProps?: { onChangeText?: (text: string) => void; value?: string };
};

const googlePlacesState = vi.hoisted(() => ({
  lastProps: null as GooglePlacesProps | null,
}));

vi.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: (props: GooglePlacesProps) => {
    googlePlacesState.lastProps = props;
    return (
      <div>
        <input
          aria-label={props.placeholder ?? 'Search Address'}
          onChange={(event) =>
            props.textInputProps?.onChangeText?.(event.target.value)
          }
          value={props.textInputProps?.value ?? ''}
        />
        <button
          onClick={() =>
            props.onPress?.({ description: '12 Allen Avenue, Ikeja, Lagos' })
          }
          type="button"
        >
          Choose suggested address
        </button>
      </div>
    );
  },
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: vi.fn() },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('./new-order.styles', () => ({ styles: { sheetInput: {} } }));

describe('NewCustomerAddressInput', () => {
  it('keeps the Google address field controlled and forwards selected addresses', () => {
    const setNewCustomer = vi.fn();

    render(
      <NewCustomerAddressInput
        address="12 Allen"
        colors={LIGHT_COLORS}
        googleMapsApiKey="maps-test-key"
        selectedCountryCode="GH"
        setNewCustomer={setNewCustomer}
      />
    );

    fireEvent.change(screen.getByLabelText('Search Address'), {
      target: { value: '12 Allen Avenue' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose suggested address' })
    );

    expect(googlePlacesState.lastProps?.query).toMatchObject({
      components: 'country:gh',
      key: 'maps-test-key',
      language: 'en',
    });
    expect(setNewCustomer).toHaveBeenCalledTimes(2);
  });

  it('falls back to a plain text input when Google Maps is unavailable', () => {
    const setNewCustomer = vi.fn();

    render(
      <NewCustomerAddressInput
        address="12 Allen"
        colors={LIGHT_COLORS}
        googleMapsApiKey={undefined}
        selectedCountryCode="NG"
        setNewCustomer={setNewCustomer}
      />
    );

    const input = screen.getByPlaceholderText('Enter address');
    fireEvent.change(input, { target: { value: '14 Bode Thomas' } });

    expect(screen.queryByLabelText('Search Address')).not.toBeInTheDocument();
    expect(setNewCustomer).toHaveBeenCalledTimes(1);
  });
});
