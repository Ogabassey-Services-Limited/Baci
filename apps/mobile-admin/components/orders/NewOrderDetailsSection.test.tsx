import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

type GooglePlacesProps = {
  onPress?: (
    data: { description: string },
    details?: {
      address_components?: Array<{
        long_name: string;
        types: string[];
      }>;
    } | null
  ) => void;
};

const googlePlacesState = vi.hoisted(() => ({
  lastProps: null as GooglePlacesProps | null,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@react-native-community/datetimepicker', () => ({
  default: ({
    onChange,
  }: {
    onChange: (_event: unknown, date?: Date) => void;
  }) => (
    <button
      aria-label="Pick order date"
      onClick={() => onChange(null, new Date('2024-02-03T00:00:00.000Z'))}
      type="button"
    >
      Pick order date
    </button>
  ),
}));

vi.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: (props: GooglePlacesProps) => {
    googlePlacesState.lastProps = props;
    return <div>google-places</div>;
  },
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Platform: { OS: 'web' },
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { onClick: () => onPress?.(), type: 'button' },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Switch: ({
      accessibilityLabel,
      onValueChange,
      value,
    }: {
      accessibilityLabel?: string;
      onValueChange?: (value: boolean) => void;
      value?: boolean;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel ?? 'Toggle delivery recipient',
        checked: value ?? false,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onValueChange?.(event.target.checked),
        type: 'checkbox',
      }),
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

import { NewOrderDetailsSection } from './NewOrderDetailsSection';

type DetailsController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'customer'
  | 'date'
  | 'deliveryInfo'
  | 'sameAsCustomer'
  | 'setDate'
  | 'setDeliveryInfo'
  | 'setSameAsCustomer'
  | 'setShowCustomerModal'
  | 'setShowDatePicker'
  | 'showDatePicker'
>;

function makeController(
  overrides: Partial<DetailsController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      background: '#f8fafc',
      backgroundLight: '#eef2ff',
      border: '#e2e8f0',
      card: '#ffffff',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#64748b',
      ...overrides.colors,
    },
    customer: {
      address: '',
      email: '',
      id: null,
      name: '',
      phone: '',
      ...overrides.customer,
    },
    date: new Date('2024-01-02T00:00:00.000Z'),
    deliveryInfo: {
      address: '',
      city: '',
      name: '',
      phone: '',
      state: '',
      ...overrides.deliveryInfo,
    },
    sameAsCustomer: true,
    setDate: vi.fn(),
    setDeliveryInfo: vi.fn(),
    setSameAsCustomer: vi.fn(),
    setShowCustomerModal: vi.fn(),
    setShowDatePicker: vi.fn(),
    showDatePicker: false,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderDetailsSection', () => {
  const originalGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    googlePlacesState.lastProps = null;
  });

  afterEach(() => {
    if (originalGoogleMapsApiKey === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalGoogleMapsApiKey;
    }
    vi.restoreAllMocks();
  });

  it('shows the selected customer summary and opens the customer sheet', () => {
    const controller = makeController({
      customer: {
        address: '12 Allen Avenue',
        email: 'ada@example.com',
        id: 'customer-1',
        name: 'Ada Lovelace',
        phone: '08012345678',
      },
    });

    render(<NewOrderDetailsSection controller={controller} />);

    expect(screen.getByText('Ada Lovelace • 08012345678')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Customer/i }));

    expect(controller.setShowCustomerModal).toHaveBeenCalledWith(true);
  });

  it('toggles the date picker and delivery recipient mode', () => {
    const controller = makeController({ sameAsCustomer: false });

    render(<NewOrderDetailsSection controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: /Date/i }));
    fireEvent.click(screen.getByLabelText('Deliver to same person'));

    expect(controller.setShowDatePicker).toHaveBeenCalled();
    expect(controller.setSameAsCustomer).toHaveBeenCalledWith(true);
    expect(screen.getByText('Recipient Name')).toBeInTheDocument();
    expect(screen.getByText('Recipient Phone')).toBeInTheDocument();
  });

  it('falls back to the manual address input and warns when the maps key is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const controller = makeController({ sameAsCustomer: false });

    render(<NewOrderDetailsSection controller={controller} />);

    expect(
      screen.getByPlaceholderText('Enter delivery address')
    ).toBeInTheDocument();
    expect(screen.queryByText('google-places')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(
      '[NewOrderDetailsSection] Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Jane Doe'), {
      target: { value: 'Grace Hopper' },
    });

    expect(controller.setDeliveryInfo).toHaveBeenCalled();
  });

  it('preserves city and state when the selected address omits those components', () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'maps-test-key';
    const setDeliveryInfo = vi.fn();
    const controller = makeController({
      deliveryInfo: {
        address: '',
        city: 'Ikeja',
        name: '',
        phone: '',
        state: 'Lagos',
      },
      sameAsCustomer: false,
      setDeliveryInfo: setDeliveryInfo as DetailsController['setDeliveryInfo'],
    });

    render(<NewOrderDetailsSection controller={controller} />);

    googlePlacesState.lastProps?.onPress?.(
      { description: '12 Allen Avenue, Lagos' },
      { address_components: [] }
    );

    expect(setDeliveryInfo).toHaveBeenCalled();
    const update = setDeliveryInfo.mock.calls.at(-1)?.[0];
    expect(typeof update).toBe('function');
    expect(
      update?.({
        address: '',
        city: 'Ikeja',
        name: '',
        phone: '',
        state: 'Lagos',
      })
    ).toEqual({
      address: '12 Allen Avenue, Lagos',
      city: 'Ikeja',
      name: '',
      phone: '',
      state: 'Lagos',
    });
  });
});
