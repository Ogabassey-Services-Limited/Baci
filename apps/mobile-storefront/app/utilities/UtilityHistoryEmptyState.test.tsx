import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';
import Colors from '@/constants/Colors';
import UtilityHistoryEmptyState from './UtilityHistoryEmptyState';

const mockLogError = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
  }),
}));

describe('UtilityHistoryEmptyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading indicator while history is loading', () => {
    const { UNSAFE_getByType } = render(
      <UtilityHistoryEmptyState
        colors={Colors.light}
        error={null}
        isLoading={true}
        refetch={jest.fn()}
      />
    );

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('logs the real error and renders a safe retry message', async () => {
    const refetch = jest.fn();
    const error = new Error('database credentials leaked');

    render(
      <UtilityHistoryEmptyState
        colors={Colors.light}
        error={error}
        isLoading={false}
        refetch={refetch}
      />
    );

    expect(screen.getByText('Unable to load history')).toBeOnTheScreen();
    expect(
      screen.getByText('Something went wrong. Please try again.')
    ).toBeOnTheScreen();
    expect(screen.queryByText('database credentials leaked')).toBeNull();

    await waitFor(() => {
      expect(mockLogError).toHaveBeenCalledWith(
        'Failed to load utility history',
        error
      );
    });

    fireEvent.press(screen.getByLabelText('Retry loading utility history'));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders an empty state when there is no history', () => {
    render(
      <UtilityHistoryEmptyState
        colors={Colors.light}
        error={null}
        isLoading={false}
        refetch={jest.fn()}
      />
    );

    expect(screen.getByText('No history yet')).toBeOnTheScreen();
  });
});
