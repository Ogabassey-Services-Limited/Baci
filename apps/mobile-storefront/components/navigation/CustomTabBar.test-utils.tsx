import { expect } from '@jest/globals';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';

function createTabDescriptor(
  title: string
): BottomTabBarProps['descriptors'][string] {
  return {
    options: {
      title,
      tabBarIcon: () => <React.Fragment />,
      tabBarLabel: () => <React.Fragment />,
    },
    navigation:
      {} as unknown as BottomTabBarProps['descriptors'][string]['navigation'],
    route: {} as unknown as BottomTabBarProps['descriptors'][string]['route'],
    render: () => <React.Fragment />,
  };
}

function createHiddenDescriptor(
  title: string
): BottomTabBarProps['descriptors'][string] {
  return {
    options: {
      href: null,
      title,
    } as unknown as BottomTabBarProps['descriptors'][string]['options'],
    navigation:
      {} as unknown as BottomTabBarProps['descriptors'][string]['navigation'],
    route: {} as unknown as BottomTabBarProps['descriptors'][string]['route'],
    render: () => <React.Fragment />,
  };
}

function expectSavedTabPress(navigation: BottomTabBarProps['navigation']) {
  expect(navigation.emit).toHaveBeenCalledWith({
    type: 'tabPress',
    target: 'saved-key',
    canPreventDefault: true,
  });
}

function expectSavedJumpDispatch(navigation: BottomTabBarProps['navigation']) {
  expect(navigation.dispatch).toHaveBeenCalledWith({
    payload: { name: 'saved', params: {} },
    type: 'JUMP_TO',
    target: 'state-key',
  });
}

export const customTabBarTestUtils = {
  createHiddenDescriptor,
  createTabDescriptor,
  expectSavedJumpDispatch,
  expectSavedTabPress,
};
