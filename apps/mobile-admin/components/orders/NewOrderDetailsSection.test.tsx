import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderDetailsSection } from './NewOrderDetailsSection';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Platform: { OS: 'ios' },
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
      onValueChange,
      value,
    }: {
      onValueChange?: (value: boolean) => void;
      value?: boolean;
    }) =>
      React.createElement('input', {
        checked: value,
        onChange: () => onValueChange?.(!value),
        type: 'checkbox',
      }),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: { target: { value: string } }) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@react-native-community/datetimepicker', () => ({
  default: () => null,
}));

vi.mock('./new-order.styles', () => ({ styles: {} }));

vi.mock('./NewOrderAddressInput', () => ({
  NewOrderAddressInput: () => null,
}));

type ControllerShape = {
  colors: {
    background: string;
    backgroundLight: string;
    border: string;
    card: string;
    primary: string;
    success: string;
    text: string;
    textMuted: string;
    textSecondary: string;
  };
  customer: { name: string; phone: string };
  date: Date;
  deliveryInfo: { name: string; phone: string };
  sameAsCustomer: boolean;
  setDate: ReturnType<typeof vi.fn>;
  setDeliveryInfo: ReturnType<typeof vi.fn>;
  setSameAsCustomer: ReturnType<typeof vi.fn>;
  setShowCustomerModal: ReturnType<typeof vi.fn>;
  setShowDatePicker: ReturnType<typeof vi.fn>;
  showDatePicker: boolean;
};

const makeController = (
  overrides: Partial<ControllerShape> = {}
): ControllerShape => ({
  colors: {
    background: '#fafafa',
    backgroundLight: '#f5f5f5',
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    success: '#16a34a',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textSecondary: '#64748b',
  },
  customer: { name: '', phone: '' },
  date: new Date('2026-04-21T00:00:00Z'),
  deliveryInfo: { name: '', phone: '' },
  sameAsCustomer: true,
  setDate: vi.fn(),
  setDeliveryInfo: vi.fn(),
  setSameAsCustomer: vi.fn(),
  setShowCustomerModal: vi.fn(),
  setShowDatePicker: vi.fn(),
  showDatePicker: false,
  ...overrides,
});

describe('NewOrderDetailsSection', () => {
  it('renders the delivery details and date labels', () => {
    const controller = makeController();

    render(
      <NewOrderDetailsSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderDetailsSection
          >['controller']
        }
      />
    );

    expect(screen.getByText('Delivery Details')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('shows the customer selector when no customer is selected yet', () => {
    const controller = makeController();

    render(
      <NewOrderDetailsSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderDetailsSection
          >['controller']
        }
      />
    );

    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
  });
});
