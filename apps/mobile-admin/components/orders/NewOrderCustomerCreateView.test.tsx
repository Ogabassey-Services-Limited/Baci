import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderCustomerCreateView } from './NewOrderCustomerCreateView';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', { role: 'status' }),
    Alert: { alert: vi.fn() },
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
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-google-places-autocomplete', async () => {
  const React = await import('react');
  return {
    GooglePlacesAutocomplete: ({ placeholder }: { placeholder?: string }) =>
      React.createElement(
        'div',
        { 'data-testid': 'google-places-autocomplete' },
        placeholder
      ),
  };
});

vi.mock('react-native-phone-number-input', async () => {
  const React = await import('react');
  return {
    default: () => React.createElement('div', { 'data-testid': 'phone-input' }),
  };
});

vi.mock('./new-order.styles', () => ({ styles: {} }));
vi.mock('./new-order.shared', () => ({
  DEFAULT_COUNTRY_CODE: 'NG',
  formatPriceInput: (v: string | undefined) => v ?? '',
  parseDecimalInput: (t: string) => t.replace(/[^0-9.]/g, ''),
}));

function makeController(overrides = {}) {
  return {
    colors: {
      background: '#fff',
      backgroundLight: '#f9f9f9',
      border: '#ccc',
      card: '#fff',
      error: '#ef4444',
      info: '#3b82f6',
      inputBg: '#f3f4f6',
      primary: '#3b82f6',
      text: '#000',
      textMuted: '#999',
      textOnPrimary: '#fff',
      textSecondary: '#666',
      warning: '#f59e0b',
      warningLight: '#fffbeb',
    },
    createCustomerMutation: { isPending: false },
    duplicateCustomer: null,
    handleCreateCustomer: vi.fn(),
    handleSelectCustomer: vi.fn(),
    newCustomer: {
      address: '',
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
    },
    resetNewCustomerForm: vi.fn(),
    selectedCountryCode: 'NG',
    setDuplicateCustomer: vi.fn(),
    setIsCreatingCustomer: vi.fn(),
    setNewCustomer: vi.fn(),
    setSelectedCountryCode: vi.fn(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('NewOrderCustomerCreateView', () => {
  it('renders without crashing', () => {
    render(<NewOrderCustomerCreateView controller={makeController()} />);
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
  });

  it('shows a plain TextInput for address when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set', () => {
    const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    render(<NewOrderCustomerCreateView controller={makeController()} />);

    expect(screen.getByPlaceholderText('Enter address')).toBeInTheDocument();
    expect(screen.queryByTestId('google-places-autocomplete')).toBeNull();

    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
  });

  it('shows GooglePlacesAutocomplete for address when API key is set', () => {
    const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'AIza-test-key';

    render(<NewOrderCustomerCreateView controller={makeController()} />);

    expect(
      screen.getByTestId('google-places-autocomplete')
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter address')).toBeNull();

    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
  });

  it('renders the first name and last name inputs', () => {
    render(<NewOrderCustomerCreateView controller={makeController()} />);
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
  });

  it('shows the duplicate customer warning when duplicateCustomer is set', () => {
    const controller = makeController({
      duplicateCustomer: {
        id: 'c1',
        first_name: 'Ada',
        last_name: 'Obi',
        phone: '08011111111',
        email: null,
        address: null,
      },
    });

    render(<NewOrderCustomerCreateView controller={controller} />);
    expect(screen.getByText('⚠️ Customer Already Exists')).toBeInTheDocument();
  });
});
