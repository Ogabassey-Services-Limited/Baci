import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { NewOrderAddressInput } from './NewOrderAddressInput';

const googlePlacesState: {
  lastProps?: Record<string, unknown>;
} = {};

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
      testID,
      value,
    }: {
      onChangeText?: (t: string) => void;
      placeholder?: string;
      testID?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'data-testid': testID,
        onChange: (e: { target: { value: string } }) =>
          onChangeText?.(e.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
  };
});

vi.mock('react-native-google-places-autocomplete', async () => {
  const React = await import('react');
  return {
    GooglePlacesAutocomplete: (props: Record<string, unknown>) => {
      googlePlacesState.lastProps = props;
      return React.createElement(
        'div',
        { 'data-testid': 'google-places-autocomplete' },
        String(props.placeholder ?? '')
      );
    },
  };
});

vi.mock('./new-order.styles', () => ({ styles: {} }));

type AddressInputController =
  React.ComponentProps<typeof NewOrderAddressInput>['controller'];

function makeController(
  overrides: Partial<AddressInputController> = {}
): AddressInputController {
  return {
    colors: LIGHT_COLORS,
    deliveryInfo: {
      address: '',
      city: '',
      name: '',
      phone: '',
      state: '',
    },
    setDeliveryInfo: vi.fn(),
    ...overrides,
  };
}

describe('NewOrderAddressInput', () => {
  it('renders a plain TextInput when googleMapsApiKey is undefined', () => {
    render(
      <NewOrderAddressInput
        controller={makeController()}
        googleMapsApiKey={undefined}
      />
    );

    expect(
      screen.getByPlaceholderText('Enter delivery address')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('google-places-autocomplete')).toBeNull();
  });

  it('renders a plain TextInput when googleMapsApiKey is an empty string', () => {
    render(
      <NewOrderAddressInput controller={makeController()} googleMapsApiKey="" />
    );

    expect(
      screen.getByPlaceholderText('Enter delivery address')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('google-places-autocomplete')).toBeNull();
  });

  it('renders GooglePlacesAutocomplete when a key is provided', () => {
    render(
      <NewOrderAddressInput
        controller={makeController()}
        googleMapsApiKey="AIza-test-key"
      />
    );

    expect(
      screen.getByTestId('google-places-autocomplete')
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter delivery address')).toBeNull();
  });

  it('calls setDeliveryInfo when the fallback TextInput changes', () => {
    const setDeliveryInfo = vi.fn();
    render(
      <NewOrderAddressInput
        controller={makeController({ setDeliveryInfo })}
        googleMapsApiKey={undefined}
      />
    );

    const input = screen.getByPlaceholderText('Enter delivery address');
    fireEvent.change(input, { target: { value: '12 Lagos Street' } });

    expect(setDeliveryInfo).toHaveBeenCalled();
  });

  it('clears stale city and state when a selected place omits those components', () => {
    const setDeliveryInfo = vi.fn();

    render(
      <NewOrderAddressInput
        controller={makeController({
          deliveryInfo: {
            address: 'Old address',
            city: 'Old city',
            name: '',
            phone: '',
            state: 'Old state',
          },
          setDeliveryInfo,
        })}
        googleMapsApiKey="AIza-test-key"
      />
    );

    const onPress = googlePlacesState.lastProps?.onPress as
      | ((
          data: { description: string },
          details?: {
            address_components?: Array<{
              long_name: string;
              types: string[];
            }>;
          } | null
        ) => void)
      | undefined;

    onPress?.(
      { description: '42 Marina, Lagos' },
      { address_components: [] }
    );

    const updater = setDeliveryInfo.mock.calls[0][0] as (
      previous: AddressInputController['deliveryInfo']
    ) => AddressInputController['deliveryInfo'];

    expect(
      updater({
        address: 'Old address',
        city: 'Old city',
        name: '',
        phone: '',
        state: 'Old state',
      })
    ).toEqual({
      address: '42 Marina, Lagos',
      city: '',
      name: '',
      phone: '',
      state: '',
    });
  });

  it('configures the Google Places dropdown elevation for Android stacking', () => {
    render(
      <NewOrderAddressInput
        controller={makeController()}
        googleMapsApiKey="AIza-test-key"
      />
    );

    const styles = googlePlacesState.lastProps?.styles as
      | {
          listView?: {
            elevation?: number;
          };
        }
      | undefined;

    expect(styles?.listView?.elevation).toBe(5);
  });
});
