import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getHomeContentBottomPadding } from '@/constants/layout';
import {
  createTemplateConfig,
  HomeScreen,
  mockGetTemplateConfig,
  setupHomeScreenTestState,
} from '../../../test-support/(tabs)/index.test-utils';

describe('HomeScreen', () => {
  setupHomeScreenTestState();

  it('renders home content inside a scroll view with bottom clearance for overlays', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('home-scroll-view')).toBeTruthy();
    expect(screen.getAllByTestId('block-renderer')).toHaveLength(3);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-scroll-view').props.contentContainerStyle
      )
    ).toMatchObject({
      paddingBottom: getHomeContentBottomPadding(34, true),
    });
  });

  it('uses tab-bar clearance only when the chat widget is disabled', () => {
    const template = createTemplateConfig();

    mockGetTemplateConfig.mockReturnValue({
      ...template,
      features: { ...template.features, chatWidget: false },
    });

    render(<HomeScreen />);

    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-scroll-view').props.contentContainerStyle
      )
    ).toMatchObject({
      paddingBottom: getHomeContentBottomPadding(34, false),
    });
  });

  it('passes scroll state to the header while keeping spacer height stable', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('mock-header')).toHaveTextContent('Header false');
    expect(
      StyleSheet.flatten(screen.getByTestId('home-header-spacer').props.style)
    ).toMatchObject({
      height: 150,
    });

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 12 },
        contentSize: { width: 375, height: 1000 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    expect(screen.getByTestId('mock-header')).toHaveTextContent('Header true');
    expect(
      StyleSheet.flatten(screen.getByTestId('home-header-spacer').props.style)
    ).toMatchObject({
      height: 150,
    });
  });
});
