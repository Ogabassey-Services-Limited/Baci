import { render, screen } from '@testing-library/react-native';
import AddressFormScreen from '@/app/addresses/[id]';

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
const mockFrom = jest.fn(() => mockQueryBuilder);

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
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
    from: mockFrom,
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
    mockUseLocalSearchParams.mockReturnValue({ id: 'new' });
    mockSingle.mockResolvedValue({
      data: { saved_addresses: [] },
      error: null,
    });
  });

  it('keeps the absolute save footer inside the shared keyboard container', () => {
    render(<AddressFormScreen />);

    const keyboardContainer = screen.getByTestId('keyboard-container');
    const saveAction = screen.getByText('Add Address');

    expect(keyboardContainer).toContainElement(saveAction);
    expect(screen.getByTestId('keyboard-aware-scroll-view')).toBeOnTheScreen();
  });
});
