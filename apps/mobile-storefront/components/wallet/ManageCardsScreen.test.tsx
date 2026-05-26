import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { SavedVtuCard } from '@/lib/vtu-checkout';
import { ManageCardsScreen } from './ManageCardsScreen';

const mockListSavedVtuCards =
  jest.fn<(options?: { signal?: AbortSignal }) => Promise<SavedVtuCard[]>>();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/vtu-checkout', () => ({
  listSavedVtuCards: (options?: { signal?: AbortSignal }) =>
    mockListSavedVtuCards(options),
}));

describe('ManageCardsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders saved cards and routes to wallet funding', async () => {
    mockListSavedVtuCards.mockResolvedValue([
      {
        bank: 'GTBank',
        brand: 'visa',
        exp_month: '12',
        exp_year: '2029',
        id: 'card-1',
        is_default: true,
        label: 'Visa card',
        last4: '4242',
        provider: 'paystack',
      },
    ]);

    render(<ManageCardsScreen />);

    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1));
    expect(mockListSavedVtuCards).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    });

    await waitFor(() =>
      expect(screen.getByText('Visa card')).toBeOnTheScreen()
    );
    expect(screen.getByText('•••• 4242 · 12/29')).toBeOnTheScreen();
    expect(screen.getByText('Default')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Fund wallet' }));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/wallet',
      params: { action: 'fund' },
    });
  });

  it('renders empty state when no cards exist', async () => {
    mockListSavedVtuCards.mockResolvedValue([]);

    render(<ManageCardsScreen />);

    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('You have no saved cards yet.')).toBeOnTheScreen()
    );
  });

  it('pads short expiry years before displaying saved card metadata', async () => {
    mockListSavedVtuCards.mockResolvedValue([
      {
        bank: null,
        brand: 'verve',
        exp_month: '8',
        exp_year: '9',
        id: 'card-1',
        is_default: false,
        label: 'Verve card',
        last4: '2662',
        provider: 'paystack',
      },
    ]);

    render(<ManageCardsScreen />);

    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('•••• 2662 · 08/09')).toBeOnTheScreen()
    );
  });

  it('shows retry state after load failure and retries on tap', async () => {
    mockListSavedVtuCards
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([]);

    render(<ManageCardsScreen />);

    await waitFor(() =>
      expect(screen.getByText('network down')).toBeOnTheScreen()
    );

    fireEvent.press(screen.getByLabelText('Retry loading cards'));

    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(2));
    expect(mockListSavedVtuCards.mock.calls[1]?.[0]).toEqual({
      signal: expect.any(AbortSignal),
    });
    await waitFor(() =>
      expect(screen.getByText('You have no saved cards yet.')).toBeOnTheScreen()
    );
  });

  it('aborts the active card load on unmount', async () => {
    let resolveCards: (cards: SavedVtuCard[]) => void = () => undefined;
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockListSavedVtuCards.mockReturnValue(
      new Promise<SavedVtuCard[]>((resolve) => {
        resolveCards = resolve;
      })
    );

    try {
      const { unmount } = render(<ManageCardsScreen />);
      const initialSignal = mockListSavedVtuCards.mock.calls[0]?.[0]?.signal;
      unmount();
      expect(initialSignal?.aborted).toBe(true);
      resolveCards([
        {
          bank: 'GTBank',
          brand: 'visa',
          exp_month: '12',
          exp_year: '2029',
          id: 'card-1',
          is_default: true,
          label: 'Visa card',
          last4: '4242',
          provider: 'paystack',
        },
      ]);

      await waitFor(() =>
        expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1)
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('aborts an in-flight refresh before starting a newer refresh', async () => {
    mockListSavedVtuCards
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(new Promise<SavedVtuCard[]>(() => undefined))
      .mockResolvedValueOnce([]);

    render(<ManageCardsScreen />);
    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1));
    // React Native Testing Library has no ScrollView role, so this is the only
    // direct testID lookup needed to reach refreshControl.props.
    const scrollView = screen.getByTestId('manage-cards-scroll-view');

    act(() => {
      // React Native Testing Library does not expose RefreshControl as a user-level gesture.
      scrollView.props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(2));
    const firstRefreshSignal = mockListSavedVtuCards.mock.calls[1]?.[0]?.signal;

    act(() => {
      // Invoke the public refreshControl handler to model a second pull-to-refresh.
      scrollView.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockListSavedVtuCards).toHaveBeenCalledTimes(3));
    expect(firstRefreshSignal?.aborted).toBe(true);
    expect(mockListSavedVtuCards.mock.calls[2]?.[0]).toEqual({
      signal: expect.any(AbortSignal),
    });
  });
});
