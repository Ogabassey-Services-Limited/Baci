import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HomeFeedEmptyState } from './HomeFeedEmptyState';

const SKELETON = <Text testID="skeleton">skeleton</Text>;

function renderEmptyState(
  props: Partial<Parameters<typeof HomeFeedEmptyState>[0]> = {}
) {
  return render(
    <HomeFeedEmptyState
      shouldShowFatalError={false}
      shouldShowInitialLoading={false}
      isLoading={false}
      isFetching={false}
      isRetrying={false}
      onRetry={jest.fn()}
      skeleton={SKELETON}
      {...props}
    />
  );
}

describe('HomeFeedEmptyState', () => {
  it('renders the skeleton while loading', () => {
    renderEmptyState({ isLoading: true });
    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(screen.queryByTestId('home-feed-error')).toBeNull();
  });

  it('renders the skeleton on the initial-loading flag', () => {
    renderEmptyState({ shouldShowInitialLoading: true });
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('renders error + retry on a fatal error', () => {
    const onRetry = jest.fn();
    renderEmptyState({ shouldShowFatalError: true, onRetry });

    expect(screen.getByTestId('home-feed-error')).toBeTruthy();
    fireEvent.press(
      screen.getByRole('button', { name: 'Retry loading products' })
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables retry and shows a retrying label while retrying', () => {
    renderEmptyState({ shouldShowFatalError: true, isRetrying: true });

    const button = screen.getByRole('button', {
      name: 'Retrying to load products',
    });
    expect(button).toBeDisabled();
    expect(screen.getByText('Retrying...')).toBeTruthy();
  });

  it('renders the filter-empty note when not fetching', () => {
    renderEmptyState();
    expect(screen.getByTestId('home-feed-empty')).toBeTruthy();
  });

  it('renders nothing while fetching (no flash of "no products")', () => {
    renderEmptyState({ isFetching: true });

    expect(screen.queryByTestId('home-feed-empty')).toBeNull();
    expect(screen.queryByTestId('home-feed-error')).toBeNull();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });
});
