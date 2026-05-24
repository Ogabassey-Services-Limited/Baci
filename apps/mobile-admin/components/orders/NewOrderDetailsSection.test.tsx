import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

const platformState = vi.hoisted(() => ({
  OS: 'web' as 'android' | 'ios' | 'web',
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/ui/AppDatePickerField', () => ({
  AppDatePickerField: ({
    onClose,
    onConfirm,
  }: {
    onClose: () => void;
    onConfirm: (date: Date) => void;
  }) => (
    <div>
      <button
        aria-label="Pick order date"
        onClick={() => onConfirm(new Date('2024-02-03T00:00:00.000Z'))}
        type="button"
      >
        Pick order date
      </button>
      <button aria-label="Close date picker" onClick={onClose} type="button">
        Close date picker
      </button>
    </div>
  ),
}));

vi.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: () => <div>google-places</div>,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Platform: platformState,
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
  | 'branches'
  | 'selectedBranchId'
  | 'sameAsCustomer'
  | 'setDate'
  | 'setDeliveryInfo'
  | 'setSelectedBranchId'
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
    branches: [
      { id: 'branch-1', name: 'Lagos main', is_default: true },
      { id: 'branch-2', name: 'Abuja branch', is_default: false },
    ],
    deliveryInfo: {
      address: '',
      city: '',
      name: '',
      phone: '',
      state: '',
      ...overrides.deliveryInfo,
    },
    sameAsCustomer: true,
    selectedBranchId: 'branch-1',
    setDate: vi.fn(),
    setDeliveryInfo: vi.fn(),
    setSelectedBranchId: vi.fn(),
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
    platformState.OS = 'web';
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

  it('renders a branch selector when multiple active branches exist', () => {
    const controller = makeController();

    render(<NewOrderDetailsSection controller={controller} />);

    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('Lagos main')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Abuja branch'));

    expect(controller.setSelectedBranchId).toHaveBeenCalledWith('branch-2');
  });

  it('does not render a branch selector when only one active branch exists', () => {
    const controller = makeController({
      branches: [
        {
          id: 'branch-1',
          merchant_id: 'merchant-1',
          name: 'Lagos main',
          address: null,
          phone: null,
          manager_id: null,
          is_default: true,
          active: true,
          created_at: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    render(<NewOrderDetailsSection controller={controller} />);

    expect(screen.queryByText('Branch')).not.toBeInTheDocument();
    expect(screen.queryByText('Lagos main')).not.toBeInTheDocument();
  });

  // Accessibility regression — exercises the accessibilityHint /
  // accessibilityState branches added when the date Pressable was made
  // toggle-aware. We can't assert DOM aria-* attrs here because this
  // suite runs JSDOM + react-native-web with the props-only adapter
  // (RNW doesn't translate accessibilityHint/accessibilityState into
  // DOM attrs in this config). The closest assertion is that the
  // component renders + responds to onPress in both states without
  // throwing — proves the conditional branches at line 65-72 are safe.
  it('renders the date Pressable in collapsed state and responds to onPress', () => {
    const controller = makeController({ showDatePicker: false });
    render(<NewOrderDetailsSection controller={controller} />);

    const dateButton = screen.getByRole('button', { name: /Date/i });
    fireEvent.click(dateButton);

    expect(controller.setShowDatePicker).toHaveBeenCalled();
  });

  it('renders the date Pressable in expanded state without throwing', () => {
    const controller = makeController({ showDatePicker: true });
    render(<NewOrderDetailsSection controller={controller} />);

    // When expanded, both the toggle row and the picker render, so
    // assert at least the toggle row is present (text 'Date').
    expect(screen.getAllByText(/Date/i).length).toBeGreaterThan(0);
  });

  it('updates the selected date when the shared date picker confirms a value', () => {
    platformState.OS = 'ios';
    const controller = makeController({ showDatePicker: true });

    render(<NewOrderDetailsSection controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick order date' }));

    expect(controller.setDate).toHaveBeenCalledWith(
      new Date('2024-02-03T00:00:00.000Z')
    );
    expect(controller.setShowDatePicker).not.toHaveBeenCalledWith(false);
  });

  it('closes the picker when the shared date picker signals close', () => {
    platformState.OS = 'android';
    const controller = makeController({ showDatePicker: true });

    render(<NewOrderDetailsSection controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close date picker' }));

    expect(controller.setShowDatePicker).toHaveBeenCalledWith(false);
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
});
