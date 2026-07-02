import './orders-screen-test-utils';
import { FlashList } from '@shopify/flash-list';
import { fireEvent, render, screen } from '@testing-library/react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { mockColors, mockOrder, mockShadows } from './orders-screen-test-utils';

describe('orders-screen test utils', () => {
  it('exports shared Orders screen fixtures', () => {
    expect(mockColors).toBe(LIGHT_COLORS);
    expect(mockShadows.lg).toBeTruthy();
    expect(mockOrder).toMatchObject({
      id: 'order-1',
      order_number: 'ORD-1001',
      payment_status: 'paid',
      shipping_status: 'pending',
    });
  });

  it('normalizes React Native styles and forwards test ids in mocks', () => {
    const onPress = vi.fn();

    render(
      <>
        <View
          testID="styled-view"
          style={[
            {
              marginVertical: 8,
              paddingHorizontal: 12,
              shadowOpacity: 0.2,
              transform: [{ scale: 0.9 }],
            },
            { paddingLeft: 20 },
          ]}
        />
        <Pressable
          accessibilityLabel="Mock action"
          onPress={onPress}
          style={({ pressed }) => [
            { bottom: 125, position: 'absolute', zIndex: 300 },
            pressed && { opacity: 0.9 },
          ]}
          testID="styled-pressable"
        />
        <Animated.View testID="animated-view" style={{ paddingVertical: 6 }} />
      </>
    );

    const view = screen.getByTestId('styled-view');
    expect(view.style.marginTop).toBe('8px');
    expect(view.style.marginBottom).toBe('8px');
    expect(view.style.paddingLeft).toBe('20px');
    expect(view.style.paddingRight).toBe('12px');
    expect(view.style.getPropertyValue('shadowOpacity')).toBe('');

    const pressable = screen.getByTestId('styled-pressable');
    expect(pressable.style.position).toBe('absolute');
    expect(pressable.style.bottom).toBe('125px');
    expect(pressable.style.zIndex).toBe('300');

    expect(screen.getByTestId('animated-view').style.paddingTop).toBe('6px');
  });

  it('renders FlashList rows, separators, and content container styles', () => {
    const onScroll = vi.fn();
    render(
      <FlashList
        contentContainerStyle={{ paddingTop: 16 }}
        data={[{ id: 'first' }, { id: 'second' }]}
        ItemSeparatorComponent={() => (
          <View testID="mock-separator" style={{ height: 16 }} />
        )}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        renderItem={({ item }) => <Text>{item.id}</Text>}
      />
    );

    const list = screen.getByTestId('orders-list-content');
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 64 });
    fireEvent.scroll(list);

    expect(list.style.paddingTop).toBe('16px');
    expect(screen.getByTestId('mock-separator').style.height).toBe('16px');
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
    expect(onScroll).toHaveBeenCalledWith({
      nativeEvent: { contentOffset: { y: 64 } },
    });
  });
});
