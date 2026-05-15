import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { HomeServiceCardBorderRunner } from './HomeServiceCardBorderRunner';

describe('HomeServiceCardBorderRunner', () => {
  it('renders one animated segment for each card edge', () => {
    render(
      <HomeServiceCardBorderRunner
        cardHeight={36}
        cardWidth={120}
        color="rgba(220, 38, 38, 0.86)"
        progress={new Animated.Value(0)}
      />
    );

    expect(screen.getByTestId('home-service-card-border-top')).toBeTruthy();
    expect(screen.getByTestId('home-service-card-border-right')).toBeTruthy();
    expect(screen.getByTestId('home-service-card-border-bottom')).toBeTruthy();
    expect(screen.getByTestId('home-service-card-border-left')).toBeTruthy();
  });

  it('keeps the runner sharp by using direct fill instead of shadow styles', () => {
    render(
      <HomeServiceCardBorderRunner
        cardHeight={36}
        cardWidth={120}
        color="rgba(220, 38, 38, 0.86)"
        progress={new Animated.Value(0)}
      />
    );

    const topStyle = StyleSheet.flatten(
      screen.getByTestId('home-service-card-border-top').props.style
    );

    expect(topStyle.backgroundColor).toBe('rgba(220, 38, 38, 0.86)');
    expect(topStyle.shadowRadius).toBeUndefined();
    expect(topStyle.elevation).toBeUndefined();
  });
});
