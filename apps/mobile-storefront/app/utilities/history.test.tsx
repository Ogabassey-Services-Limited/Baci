import { fireEvent, render, screen } from '@testing-library/react-native';

const mockUseRequireAuth = jest.fn();
const mockUseVTUHistory = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: (...args: unknown[]) => mockUseVTUHistory(...args),
}));

jest.mock('expo-router', () => {
  return {
    Redirect: ({ href }: { href: string }) => {
      const { Text } =
        jest.requireActual<typeof import('react-native')>('react-native');
      return <Text>{`Redirect:${href}`}</Text>;
    },
    Stack: {
      Screen: () => null,
    },
    useLocalSearchParams: () => ({ type: 'power' }),
  };
});

import UtilityHistoryScreen from '@/app/utilities/history';

describe('UtilityHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
    });
    mockUseVTUHistory.mockReturnValue({
      data: [
        {
          id: 'tx-1',
          created_at: '2026-04-08T12:00:00.000Z',
          type: 'electricity',
          status: 'successful',
          amount: 2500,
          biller_name: 'EKEDC NG',
          customer_identifier: '1234567890',
          request_reference: 'VTU-123',
          customer_cashback: 100,
        },
      ],
      error: null,
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
  });

  it('renders recent transactions and highlights the preselected filter', () => {
    render(<UtilityHistoryScreen />);

    expect(screen.getByText('Power')).toBeTruthy();
    expect(screen.getByText('EKEDC NG')).toBeTruthy();
    expect(screen.getByText(/Ref: VTU-123/)).toBeTruthy();
    expect(screen.getByText(/Cashback:/)).toBeTruthy();
    expect(mockUseVTUHistory).toHaveBeenCalledWith('power', 30);
  });

  it('redirects unauthenticated users to login', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: '/auth/login?returnTo=%2Futilities%2Fhistory',
    });

    render(<UtilityHistoryScreen />);

    expect(
      screen.getByText('Redirect:/auth/login?returnTo=%2Futilities%2Fhistory')
    ).toBeTruthy();
  });

  it('changes filters when the user taps a chip', () => {
    render(<UtilityHistoryScreen />);
    fireEvent.press(screen.getByLabelText('Show airtime history'));

    expect(mockUseVTUHistory).toHaveBeenLastCalledWith('airtime', 30);
  });
});
