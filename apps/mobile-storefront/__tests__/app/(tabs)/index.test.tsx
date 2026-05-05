import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
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
});
