import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CountryCode } from 'react-native-country-picker-modal';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import type { SelectableCustomer } from '@/components/orders/new-order.types';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { LIGHT_COLORS } from '@/constants/theme';
import { DEFAULT_COUNTRY_CODE } from './new-order.shared';

type GooglePlacesProps = {
  onPress?: (data: { description: string }) => void;
  placeholder?: string;
  query?: { components?: string; key?: string; language?: string };
  textInputProps?: { onChangeText?: (text: string) => void; value?: string };
};

const googlePlacesState = vi.hoisted(() => ({
  lastProps: null as GooglePlacesProps | null,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: (props: GooglePlacesProps) => {
    googlePlacesState.lastProps = props;
    return (
      <div>
        <input
          aria-label={props.placeholder ?? 'Search Address'}
          onChange={(event) => props.textInputProps?.onChangeText?.(event.target.value)}
          value={props.textInputProps?.value ?? ''}
        />
        <button
          aria-label="Choose suggested address"
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

vi.mock('react-native-phone-number-input', () => ({
  default: ({
    defaultValue,
    onChangeCountry,
    onChangeFormattedText,
  }: {
    defaultValue?: string;
    onChangeCountry?: (country: { cca2: CountryCode }) => void;
    onChangeFormattedText?: (value: string) => void;
  }) => (
    <div>
      <input aria-label="Phone Number" defaultValue={defaultValue ?? ''} onChange={(event) => onChangeFormattedText?.(event.target.value)} />
      <button
        aria-label="Switch phone country"
        onClick={() => onChangeCountry?.({ cca2: 'GH' })}
        type="button"
      >
        Switch phone country
      </button>
    </div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('span', { role: 'progressbar' }, 'loading'),
    Alert: { alert: vi.fn() },
    Pressable: ({
      children,
      disabled,
      onPress,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          disabled,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
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

import { NewOrderCustomerCreateView } from './NewOrderCustomerCreateView';

type CustomerCreateController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'createCustomerMutation'
  | 'duplicateCustomer'
  | 'handleCreateCustomer'
  | 'handleSelectCustomer'
  | 'newCustomer'
  | 'resetNewCustomerForm'
  | 'selectedCountryCode'
  | 'setDuplicateCustomer'
  | 'setIsCreatingCustomer'
  | 'setNewCustomer'
  | 'setSelectedCountryCode'
>;

function applyStateUpdate<T>(
  update: React.SetStateAction<T>,
  previous: T
): T {
  return typeof update === 'function'
    ? (update as (value: T) => T)(previous)
    : update;
}

function makeController(overrides: Partial<CustomerCreateController> = {}) {
  const state = {
    duplicateCustomer:
      overrides.duplicateCustomer ?? (null as SelectableCustomer | null),
    newCustomer: overrides.newCustomer ?? createEmptyNewCustomerDraft(),
    selectedCountryCode:
      overrides.selectedCountryCode ?? DEFAULT_COUNTRY_CODE,
  };

  const controller: CustomerCreateController = {
    colors: { ...LIGHT_COLORS, ...overrides.colors },
    createCustomerMutation: {
      isPending: false,
      ...overrides.createCustomerMutation,
    } as CustomerCreateController['createCustomerMutation'],
    duplicateCustomer: state.duplicateCustomer,
    handleCreateCustomer: overrides.handleCreateCustomer ?? vi.fn(),
    handleSelectCustomer: overrides.handleSelectCustomer ?? vi.fn(),
    newCustomer: state.newCustomer,
    resetNewCustomerForm: overrides.resetNewCustomerForm ?? vi.fn(),
    selectedCountryCode: state.selectedCountryCode,
    setDuplicateCustomer:
      overrides.setDuplicateCustomer ??
      vi.fn((value: React.SetStateAction<SelectableCustomer | null>) => {
        state.duplicateCustomer = applyStateUpdate(value, state.duplicateCustomer);
      }),
    setIsCreatingCustomer: overrides.setIsCreatingCustomer ?? vi.fn(),
    setNewCustomer:
      overrides.setNewCustomer ??
      vi.fn((value: React.SetStateAction<typeof state.newCustomer>) => {
        state.newCustomer = applyStateUpdate(value, state.newCustomer);
      }),
    setSelectedCountryCode:
      overrides.setSelectedCountryCode ??
      vi.fn((value: React.SetStateAction<CountryCode>) => {
        state.selectedCountryCode = applyStateUpdate(
          value,
          state.selectedCountryCode
        );
      }),
  };

  return {
    controller,
    snapshot: (): ReturnType<typeof useNewOrderController> =>
      ({
        ...controller,
        duplicateCustomer: state.duplicateCustomer,
        newCustomer: state.newCustomer,
        selectedCountryCode: state.selectedCountryCode,
      }) as ReturnType<typeof useNewOrderController>,
  };
}

describe('NewOrderCustomerCreateView', () => {
  const originalGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'maps-test-key';
    googlePlacesState.lastProps = null;
  });

  afterEach(() => {
    if (originalGoogleMapsApiKey === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalGoogleMapsApiKey;
    }
  });

  it('updates the draft fields and keeps the address input controlled', () => {
    const harness = makeController();
    const view = render(<NewOrderCustomerCreateView controller={harness.snapshot()} />);
    const rerender = () =>
      view.rerender(<NewOrderCustomerCreateView controller={harness.snapshot()} />);
    ([['First Name', 'Ada'], ['Last Name', 'Lovelace']] as const).forEach(
      ([placeholder, value]) => {
      fireEvent.change(screen.getByPlaceholderText(placeholder), {
        target: { value },
      });
      rerender();
      }
    );
    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '08012345678' },
    });
    rerender();
    fireEvent.click(screen.getByRole('button', { name: 'Switch phone country' }));
    rerender();
    fireEvent.change(screen.getByLabelText('Search Address'), {
      target: { value: '12 Allen' },
    });
    rerender();
    expect(screen.getByPlaceholderText('First Name')).toHaveValue('Ada');
    expect(screen.getByPlaceholderText('Last Name')).toHaveValue('Lovelace');
    expect(screen.getByLabelText('Search Address')).toHaveValue('12 Allen');
    expect(harness.controller.setSelectedCountryCode).toHaveBeenCalledWith('GH');
    expect(googlePlacesState.lastProps?.query).toMatchObject({
      components: 'country:gh',
      key: 'maps-test-key',
      language: 'en',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Choose suggested address' })
    );
    rerender();
    expect(screen.getByLabelText('Search Address')).toHaveValue(
      '12 Allen Avenue, Ikeja, Lagos'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    expect(harness.controller.handleCreateCustomer).toHaveBeenCalledTimes(1);
  });

  it('renders a loading state while the customer mutation is pending', () => {
    const harness = makeController({
      createCustomerMutation:
        { isPending: true } as CustomerCreateController['createCustomerMutation'],
    });

    render(<NewOrderCustomerCreateView controller={harness.snapshot()} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').closest('button')).toBeDisabled();
    expect(screen.queryByText('Save Customer')).not.toBeInTheDocument();
  });

  it('surfaces an existing duplicate customer and reuses it from the banner', () => {
    const duplicateCustomer: SelectableCustomer = {
      address: '12 Allen Avenue', email: 'ada@example.com', first_name: 'Ada', id: 'customer-1', last_name: 'Lovelace', phone: '08012345678',
    };
    const harness = makeController({ duplicateCustomer });
    render(<NewOrderCustomerCreateView controller={harness.snapshot()} />);
    expect(screen.getByText('⚠️ Customer Already Exists')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('08012345678')).toBeInTheDocument();
    const useExistingCustomerButton =
      screen.getByText('Use This').closest('button');
    expect(useExistingCustomerButton).not.toBeNull();
    fireEvent.click(useExistingCustomerButton!);
    expect(harness.controller.handleSelectCustomer).toHaveBeenCalledWith(
      duplicateCustomer
    );
    expect(harness.controller.setDuplicateCustomer).toHaveBeenCalledWith(null);
    expect(harness.controller.setIsCreatingCustomer).toHaveBeenCalledWith(false);
    expect(harness.controller.resetNewCustomerForm).toHaveBeenCalledTimes(1);
  });
});
