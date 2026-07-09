import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { ProductsListShell } from './ProductsListShell';

interface FlashListMockProps<T> {
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  data?: T[] | null;
  keyExtractor: (item: T) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScroll?: unknown;
  refreshControl?: ReactElement;
  renderItem: (info: { item: T; index: number }) => ReactElement | null;
  scrollEventThrottle?: number;
  showsVerticalScrollIndicator?: boolean;
}

interface RefreshControlMockProps {
  onRefresh?: () => void;
  refreshing?: boolean;
}

const flashListMock = vi.hoisted(() => ({
  props: null as FlashListMockProps<{ id: string; label: string }> | null,
}));

vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');
  return {
    FlashList: (props: FlashListMockProps<{ id: string; label: string }>) => {
      flashListMock.props = props;
      return React.createElement(
        'div',
        null,
        props.data && props.data.length > 0
          ? props.data.map((item, index) =>
              React.createElement(
                'div',
                { key: props.keyExtractor(item) },
                props.renderItem({ item, index })
              )
            )
          : props.ListEmptyComponent,
        props.ListFooterComponent,
        React.createElement(
          'button',
          { onClick: props.onEndReached, type: 'button' },
          'load more'
        )
      );
    },
  };
});

describe('ProductsListShell', () => {
  it('renders rows, footer, and forwards list behavior props', () => {
    const onEndReached = vi.fn();
    const onRefresh = vi.fn();
    const onScroll = vi.fn();

    render(
      <ProductsListShell
        colors={{ gold: '#facc15' }}
        data={[{ id: 'one', label: 'Xiaomi 13T' }]}
        emptyComponent={<Text>No products</Text>}
        footerComponent={<Text>Loading more</Text>}
        keyExtractor={(item) => item.id}
        onEndReached={onEndReached}
        onRefresh={onRefresh}
        onScroll={onScroll}
        refreshing={true}
        renderItem={({ item }) => <Text>{item.label}</Text>}
      />
    );

    expect(screen.getByText('Xiaomi 13T')).toBeTruthy();
    expect(screen.getByText('Loading more')).toBeTruthy();
    expect(screen.queryByText('No products')).toBeNull();
    expect(flashListMock.props?.onEndReachedThreshold).toBe(0.5);
    expect(flashListMock.props?.scrollEventThrottle).toBe(16);
    expect(flashListMock.props?.showsVerticalScrollIndicator).toBe(false);
    const refreshControlProps = flashListMock.props?.refreshControl
      ?.props as RefreshControlMockProps;

    expect(refreshControlProps.refreshing).toBe(true);
    expect(refreshControlProps.onRefresh).toBe(onRefresh);
    expect(flashListMock.props?.onScroll).toBe(onScroll);

    fireEvent.click(screen.getByRole('button', { name: 'load more' }));
    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it('renders the empty component when no products are available', () => {
    render(
      <ProductsListShell
        colors={{ gold: '#facc15' }}
        data={[] as Array<{ id: string; label: string }>}
        emptyComponent={<Text>No products</Text>}
        keyExtractor={(item) => item.id}
        onRefresh={vi.fn()}
        onScroll={vi.fn()}
        refreshing={false}
        renderItem={({ item }) => <Text>{item.label}</Text>}
      />
    );

    expect(screen.getByText('No products')).toBeTruthy();
  });
});
