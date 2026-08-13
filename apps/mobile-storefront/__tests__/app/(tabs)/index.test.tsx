import { describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getHomeContentBottomPadding } from '@/constants/layout';
import {
  createTemplateConfig,
  HomeScreen,
  mockGetTemplateConfig,
  mockHomeFeedList,
  mockInvalidateQueries,
  mockResetQueries,
  setupHomeScreenTestState,
} from '../../../test-support/(tabs)/index.test-utils';

function lastFeedProps() {
  return mockHomeFeedList.mock.calls.at(-1)?.[0];
}

describe('HomeScreen', () => {
  setupHomeScreenTestState();

  it('renders the virtualized home feed with bottom clearance for overlays', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('home-feed-list')).toBeTruthy();
    // Hero + injected JustLaunched + CategoryRail + ProductGrid.
    expect(screen.getAllByTestId('block-renderer')).toHaveLength(4);
    expect(screen.getByText('JustLaunched')).toBeTruthy();
    expect(lastFeedProps()?.contentBottomPadding).toBe(
      getHomeContentBottomPadding(34, true)
    );
  });

  it('uses tab-bar clearance only when the chat widget is disabled', () => {
    const template = createTemplateConfig();

    mockGetTemplateConfig.mockReturnValue({
      ...template,
      features: { ...template.features, chatWidget: false },
    });

    render(<HomeScreen />);

    expect(lastFeedProps()?.contentBottomPadding).toBe(
      getHomeContentBottomPadding(34, false)
    );
  });

  it('passes scroll state to the header when the feed scrolls', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('mock-header')).toHaveTextContent('Header false');

    fireEvent.scroll(screen.getByTestId('home-feed-list'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 12 },
        contentSize: { width: 375, height: 1000 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    expect(screen.getByTestId('mock-header')).toHaveTextContent('Header true');
  });

  it('resets the products query and invalidates categories on pull-to-refresh', async () => {
    render(<HomeScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('home-feed-refresh'));
      await Promise.resolve();
    });

    // Partial prefix keys match useProducts' ['products', merchantId, options].
    expect(mockResetQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['categories', 'merchant-1'],
    });
  });
});
