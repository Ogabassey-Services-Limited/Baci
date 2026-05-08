import type React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import AddressFormScreen from '@/app/addresses/[id]';

type TouchableOpacityMockProps =
  React.ComponentProps<typeof import('react-native').TouchableOpacity>;

const mockAlert = jest.fn();
const mockBack = jest.fn();
const mockToastSuccess = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({ id: 'new' }));

type SupabaseAddressResult = {
  data: { saved_addresses: unknown[] };
  error: null;
};

type SupabaseChainMethod = (...args: unknown[]) => SupabaseQueryBuilderMock;
type SupabaseQueryBuilderMock = {
  eq: jest.MockedFunction<SupabaseChainMethod>;
  insert: jest.MockedFunction<SupabaseChainMethod>;
  match: jest.MockedFunction<SupabaseChainMethod>;
  select: jest.MockedFunction<SupabaseChainMethod>;
  single: jest.MockedFunction<() => Promise<SupabaseAddressResult>>;
  update: jest.MockedFunction<SupabaseChainMethod>;
};

const mockSingle = jest.fn<Promise<SupabaseAddressResult>, []>(async () => ({
  data: { saved_addresses: [] },
  error: null,
}));
const mockQueryBuilder = {} as SupabaseQueryBuilderMock;
const createChainMock = () =>
  jest.fn<SupabaseQueryBuilderMock, unknown[]>(() => mockQueryBuilder);

Object.assign(mockQueryBuilder, {
  eq: createChainMock(),
  insert: createChainMock(),
  match: createChainMock(),
  select: createChainMock(),
  single: mockSingle,
  update: createChainMock(),
});
const mockFrom = jest.fn<SupabaseQueryBuilderMock, [string]>(
  () => mockQueryBuilder
);

const resetSupabaseChainMocks = () => {
  mockQueryBuilder.eq.mockImplementation(() => mockQueryBuilder);
  mockQueryBuilder.insert.mockImplementation(() => mockQueryBuilder);
  mockQueryBuilder.match.mockImplementation(() => mockQueryBuilder);
  mockQueryBuilder.select.mockImplementation(() => mockQueryBuilder);
  mockQueryBuilder.update.mockImplementation(() => mockQueryBuilder);
  mockFrom.mockReturnValue(mockQueryBuilder);
};

jest.mock('react-native', () => {
  const React = require('react') as typeof import('react');
  const actual =
    jest.requireActual<typeof import('react-native')>('react-native');
  const TouchableOpacity = ({
    children,
    disabled,
    onPress,
    ...props
  }: TouchableOpacityMockProps) => {
    const viewProps = {
      ...props,
      accessibilityState: {
        ...props.accessibilityState,
        disabled: Boolean(disabled),
      },
      onPress: disabled ? undefined : onPress,
    } as React.ComponentProps<typeof actual.View> & {
      onPress?: TouchableOpacityMockProps['onPress'];
    };

    return React.createElement(actual.View, viewProps, children);
  };

  return new Proxy(actual, {
    get(target, property, receiver) {
      if (property === 'TouchableOpacity') {
        return TouchableOpacity;
      }

      return Reflect.get(target, property, receiver);
    },
  });
});

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    Toast: () => null,
  }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: { id: string };
      merchantId: string;
    }) => unknown
  ) =>
    selector({
      customer: { id: 'customer-1' },
      merchantId: 'merchant-1',
    }),
}));

describe('AddressFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSupabaseChainMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(mockAlert);
    mockUseLocalSearchParams.mockReturnValue({ id: 'new' });
    mockSingle.mockResolvedValue({
      data: { saved_addresses: [] },
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the absolute save footer inside the shared keyboard container', () => {
    render(<AddressFormScreen />);

    const keyboardContainer = screen.getByTestId('keyboard-container');
    const saveAction = screen.getByText('Add Address');

    expect(keyboardContainer).toContainElement(saveAction);
    expect(screen.getByPlaceholderText('Enter full name')).toBeOnTheScreen();
  });

  it('saves a new address through the Supabase update path', async () => {
    jest.useFakeTimers();

    render(<AddressFormScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter full name'),
      'Ada Lovelace'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. 08012345678'),
      '08031234567'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter street address'),
      '1 Compute Lane'
    );
    fireEvent.changeText(screen.getByPlaceholderText('Enter city'), 'Lagos');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ada Lovelace')).toBeOnTheScreen();
      expect(screen.getByDisplayValue('1 Compute Lane')).toBeOnTheScreen();
    });

    const addAddressButton = screen.getByLabelText('Add Address');
    fireEvent.press(addAddressButton);

    expect(screen.queryByText('Name is required')).toBeNull();
    expect(screen.queryByText('Phone number is required')).toBeNull();
    expect(screen.queryByText('Enter a valid Nigerian phone number')).toBeNull();
    expect(screen.queryByText('Address is required')).toBeNull();
    expect(screen.queryByText('City is required')).toBeNull();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('customers');
    });
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('saved_addresses');
    expect(mockQueryBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'customer-1');
    expect(mockQueryBuilder.eq).toHaveBeenNthCalledWith(
      2,
      'merchant_id',
      'merchant-1'
    );

    await waitFor(() => {
      expect(mockSingle).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        saved_addresses: [
          expect.objectContaining({
            address: '1 Compute Lane',
            city: 'Lagos',
            country: 'Nigeria',
            full_name: 'Ada Lovelace',
            id: expect.stringMatching(/^addr_\d+$/),
            label: 'Home',
            phone: '08031234567',
            state: 'Lagos',
          }),
        ],
      });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Address added successfully'
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows an alert when saving the address fails', async () => {
    const writeError = new Error('write failed');
    const failedSecondEq = jest.fn(() => ({
      data: null,
      error: writeError,
    }));
    const failedFirstEq = jest.fn(() => ({
      eq: failedSecondEq,
    }));
    mockQueryBuilder.update.mockReturnValueOnce({
      eq: failedFirstEq,
    } as unknown as SupabaseQueryBuilderMock);

    render(<AddressFormScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter full name'),
      'Ada Lovelace'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. 08012345678'),
      '08031234567'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter street address'),
      '1 Compute Lane'
    );
    fireEvent.changeText(screen.getByPlaceholderText('Enter city'), 'Lagos');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ada Lovelace')).toBeOnTheScreen();
      expect(screen.getByDisplayValue('1 Compute Lane')).toBeOnTheScreen();
    });

    const addAddressButton = screen.getByLabelText('Add Address');
    fireEvent.press(addAddressButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Failed to save address'
      );
    });
    expect(mockSingle).toHaveBeenCalledTimes(1);
    expect(failedSecondEq).toHaveReturnedWith({
      data: null,
      error: writeError,
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
