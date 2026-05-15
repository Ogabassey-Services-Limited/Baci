import { jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  getProductGridCalls,
  HomeScreen,
  mockUsePageConfig,
  setupHomeScreenTestState,
} from '../../../test-support/(tabs)/index.test-utils';

describe('HomeScreen pagination', () => {
  setupHomeScreenTestState();

  it('signals the product grid to load more when the home scroll reaches the bottom', () => {
    render(<HomeScreen />);

    const initialProductGridCalls = getProductGridCalls();
    expect(initialProductGridCalls.length).toBeGreaterThan(0);
    expect(
      initialProductGridCalls[initialProductGridCalls.length - 1]?.[0]
    ).toMatchObject({
      productGridLoadMoreSignal: 0,
    });

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    expect(productGridCalls[productGridCalls.length - 1]?.[0]).toMatchObject({
      productGridLoadMoreSignal: 1,
    });
  });

  it('does not emit another load-more signal when the user scrolls upward near the bottom', () => {
    render(<HomeScreen />);

    const scrollView = screen.getByTestId('home-scroll-view');

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1000 },
        contentSize: { width: 375, height: 1700 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1080 },
        contentSize: { width: 375, height: 1700 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    expect(productGridCalls[productGridCalls.length - 1]?.[0]).toMatchObject({
      productGridLoadMoreSignal: 1,
    });
  });

  it('keeps load-more signals monotonic across pull-to-refresh', async () => {
    const refetch = jest.fn(async () => undefined);
    mockUsePageConfig.mockReturnValue({
      data: {
        content: [
          { type: 'HeroCarousel', props: { id: 'hero-1', slides: [] } },
          { type: 'CategoryRail', props: { id: 'categories-1' } },
          { type: 'ProductGrid', props: { id: 'products-1', limit: 12 } },
        ],
      },
      isLoading: false,
      isError: false,
      refetch,
    });

    render(<HomeScreen />);

    const scrollView = screen.getByTestId('home-scroll-view');

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    expect(productGridCalls[productGridCalls.length - 1]?.[0]).toMatchObject({
      productGridLoadMoreSignal: 2,
    });
  });

  it('allows retrying load-more after leaving the bottom zone without content growth', () => {
    render(<HomeScreen />);

    const scrollView = screen.getByTestId('home-scroll-view');

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 600 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    expect(productGridCalls[productGridCalls.length - 1]?.[0]).toMatchObject({
      productGridLoadMoreSignal: 2,
    });
  });

  it('resets the load-more baseline when the active home dataset changes', () => {
    const refetch = jest.fn(async () => undefined);
    let pageConfig = {
      content: [
        { type: 'HeroCarousel', props: { id: 'hero-1', slides: [] } },
        { type: 'CategoryRail', props: { id: 'categories-1' } },
        { type: 'ProductGrid', props: { id: 'products-1', limit: 12 } },
      ],
    };
    mockUsePageConfig.mockImplementation(() => ({
      data: pageConfig,
      isLoading: false,
      isError: false,
      refetch,
    }));

    const view = render(<HomeScreen />);

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    pageConfig = {
      content: [
        { type: 'HeroCarousel', props: { id: 'hero-2', slides: [] } },
        { type: 'CategoryRail', props: { id: 'categories-2' } },
        { type: 'ProductGrid', props: { id: 'products-2', limit: 12 } },
      ],
    };

    view.rerender(<HomeScreen />);

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 700 },
        contentSize: { width: 375, height: 1200 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    expect(productGridCalls[productGridCalls.length - 1]?.[0]).toMatchObject({
      productGridLoadMoreSignal: 2,
    });
  });

  it('adapts the load-more baseline when the current content height shrinks', () => {
    render(<HomeScreen />);

    const scrollView = screen.getByTestId('home-scroll-view');

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { x: 0, y: 700 },
        contentSize: { width: 375, height: 1200 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    expect(productGridCalls[productGridCalls.length - 1]?.[0]).toMatchObject({
      productGridLoadMoreSignal: 2,
    });
  });

  it('scopes the load-more signal to the primary ProductGrid block', () => {
    mockUsePageConfig.mockReturnValue({
      data: {
        content: [
          { type: 'HeroCarousel', props: { id: 'hero-1', slides: [] } },
          { type: 'ProductGrid', props: { id: 'products-1', limit: 12 } },
          { type: 'ProductGrid', props: { id: 'products-2', limit: 12 } },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<HomeScreen />);

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    const primaryGridCalls = productGridCalls.filter(
      ([props]) => props.blocks[0]?.props?.id === 'products-1'
    );
    const secondaryGridCalls = productGridCalls.filter(
      ([props]) => props.blocks[0]?.props?.id === 'products-2'
    );

    expect(primaryGridCalls.at(-1)?.[0]).toMatchObject({
      productGridLoadMoreSignal: 1,
    });
    expect(secondaryGridCalls.at(-1)?.[0]).toMatchObject({
      productGridLoadMoreSignal: 0,
    });
  });

  it('treats the first ProductGrid without an id as the primary grid', () => {
    mockUsePageConfig.mockReturnValue({
      data: {
        content: [
          { type: 'HeroCarousel', props: { id: 'hero-1', slides: [] } },
          { type: 'ProductGrid', props: { limit: 12 } },
          { type: 'ProductGrid', props: { id: 'products-2', limit: 12 } },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<HomeScreen />);

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = getProductGridCalls();
    const unnamedGridCalls = productGridCalls.filter(
      ([props]) => props.blocks[0]?.props?.id == null
    );
    const secondaryGridCalls = productGridCalls.filter(
      ([props]) => props.blocks[0]?.props?.id === 'products-2'
    );

    expect(unnamedGridCalls.at(-1)?.[0]).toMatchObject({
      productGridLoadMoreSignal: 1,
    });
    expect(secondaryGridCalls.at(-1)?.[0]).toMatchObject({
      productGridLoadMoreSignal: 0,
    });
  });
});
