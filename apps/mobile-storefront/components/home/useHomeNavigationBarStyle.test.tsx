import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { NavigationContext } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';
import { Platform, Text } from 'react-native';
import { useHomeNavigationBarStyle } from './useHomeNavigationBarStyle';

const mockSetNavigationBarStyle = jest.fn();
const originalPlatformOS = Platform.OS;
type NavigationContextValue = NonNullable<
  ComponentProps<typeof NavigationContext.Provider>['value']
>;

jest.mock('expo-navigation-bar', () => ({
  setStyle: (...args: unknown[]) => mockSetNavigationBarStyle(...args),
}));

function setPlatformOS(value: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value,
  });
}

function createNavigationMock(initialFocused = true) {
  let focused = initialFocused;
  const listeners: Record<'blur' | 'focus', Set<() => void>> = {
    blur: new Set(),
    focus: new Set(),
  };
  const navigation = {
    addListener: jest.fn((event: 'blur' | 'focus', callback: () => void) => {
      listeners[event].add(callback);
      return () => listeners[event].delete(callback);
    }),
    isFocused: jest.fn(() => focused),
  } as unknown as NavigationContextValue;

  return {
    emit(event: 'blur' | 'focus') {
      focused = event === 'focus';
      for (const callback of listeners[event]) {
        callback();
      }
    },
    navigation,
  };
}

function HookHarness({
  colorScheme,
  enabled = true,
  navigation,
}: {
  colorScheme: 'dark' | 'light';
  enabled?: boolean;
  navigation: NavigationContextValue;
}) {
  return (
    <NavigationContext.Provider value={navigation}>
      <HookConsumer colorScheme={colorScheme} enabled={enabled} />
    </NavigationContext.Provider>
  );
}

function HookConsumer({
  colorScheme,
  enabled,
}: {
  colorScheme: 'dark' | 'light';
  enabled: boolean;
}) {
  useHomeNavigationBarStyle(colorScheme, enabled);
  return <Text>home</Text>;
}

describe('useHomeNavigationBarStyle', () => {
  beforeEach(() => {
    mockSetNavigationBarStyle.mockClear();
    setPlatformOS('android');
  });

  afterEach(() => {
    setPlatformOS(originalPlatformOS);
  });

  it('keeps Home navigation bar buttons light when the color scheme changes', () => {
    const { navigation } = createNavigationMock(true);
    const { rerender } = render(
      <HookHarness colorScheme="light" navigation={navigation} />
    );

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');

    rerender(<HookHarness colorScheme="dark" navigation={navigation} />);

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');
  });

  it('restores the root navigation bar style when Home loses focus', () => {
    const { emit, navigation } = createNavigationMock(true);
    render(<HookHarness colorScheme="light" navigation={navigation} />);

    act(() => {
      emit('blur');
    });

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('dark');
  });

  it('keeps the root navigation bar style while the Home override is disabled', () => {
    const { navigation } = createNavigationMock(true);
    const { rerender } = render(
      <HookHarness
        colorScheme="light"
        enabled={false}
        navigation={navigation}
      />
    );

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('dark');

    rerender(
      <HookHarness colorScheme="light" enabled navigation={navigation} />
    );

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');
  });
});
