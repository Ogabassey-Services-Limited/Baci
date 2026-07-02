import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { NewCustomerAddressInput } from './NewCustomerAddressInput';

const keyboardState = vi.hoisted(() => ({
  dismiss: vi.fn(),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    Keyboard: { dismiss: keyboardState.dismiss },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          role: accessibilityRole === 'button' ? 'button' : undefined,
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
      onBlur,
      onChangeText,
      onFocus,
      placeholder,
      value,
    }: {
      onBlur?: () => void;
      onChangeText?: (value: string) => void;
      onFocus?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onBlur,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onFocus,
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('NewCustomerAddressInput', () => {
  beforeEach(() => {
    keyboardState.dismiss.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches address suggestions without nesting a virtualized autocomplete list', async () => {
    const setNewCustomer = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        predictions: [
          {
            description: '12 Allen Avenue, Ikeja, Lagos',
            place_id: 'place-1',
            structured_formatting: {
              main_text: '12 Allen Avenue',
              secondary_text: 'Ikeja, Lagos',
            },
          },
        ],
      }),
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(
      <NewCustomerAddressInput
        address=""
        colors={LIGHT_COLORS}
        googleMapsApiKey="maps-test-key"
        selectedCountryCode="GH"
        setNewCustomer={setNewCustomer}
      />
    );

    fireEvent.focus(screen.getByPlaceholderText('Search Address'));
    fireEvent.change(screen.getByPlaceholderText('Search Address'), {
      target: { value: '12 Allen Avenue' },
    });

    view.rerender(
      <NewCustomerAddressInput
        address="12 Allen Avenue"
        colors={LIGHT_COLORS}
        googleMapsApiKey="maps-test-key"
        selectedCountryCode="GH"
        setNewCustomer={setNewCustomer}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=12+Allen+Avenue&key=maps-test-key&language=en&components=country%3Agh'
      );
    });

    expect(screen.getByText('12 Allen Avenue')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use address 12 Allen Avenue, Ikeja, Lagos',
      })
    );

    expect(setNewCustomer).toHaveBeenCalledTimes(2);
    expect(keyboardState.dismiss).toHaveBeenCalledTimes(1);
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
