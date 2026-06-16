import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import {
  type NavigationBarButtonStyle,
  NavigationBarStyleProvider,
  useNavigationBarStyleOverride,
} from './NavigationBarStyleProvider';

const mockSetNavigationBarStyle = jest.fn();
const originalPlatformOS = Platform.OS;

jest.mock('expo-navigation-bar', () => ({
  setStyle: (...args: unknown[]) => mockSetNavigationBarStyle(...args),
}));

function setPlatformOS(value: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value,
  });
}

function OverrideConsumer({
  style,
}: {
  style: NavigationBarButtonStyle | null;
}) {
  useNavigationBarStyleOverride(style);
  return <Text>screen</Text>;
}

describe('NavigationBarStyleProvider', () => {
  beforeEach(() => {
    mockSetNavigationBarStyle.mockClear();
    setPlatformOS('android');
  });

  afterEach(() => {
    setPlatformOS(originalPlatformOS);
  });

  it('lets a focused screen override the root navigation bar style', async () => {
    render(
      <NavigationBarStyleProvider rootStyle="dark">
        <OverrideConsumer style="light" />
      </NavigationBarStyleProvider>
    );

    await waitFor(() => {
      expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');
    });
  });

  it('restores the root style when an override is cleared', async () => {
    const { rerender } = render(
      <NavigationBarStyleProvider rootStyle="dark">
        <OverrideConsumer style="light" />
      </NavigationBarStyleProvider>
    );

    await waitFor(() => {
      expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');
    });

    rerender(
      <NavigationBarStyleProvider rootStyle="dark">
        <OverrideConsumer style={null} />
      </NavigationBarStyleProvider>
    );

    await waitFor(() => {
      expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('dark');
    });
  });

  it('does not set the navigation bar style on non-Android platforms', () => {
    setPlatformOS('ios');

    render(
      <NavigationBarStyleProvider rootStyle="dark">
        <OverrideConsumer style="light" />
      </NavigationBarStyleProvider>
    );

    expect(mockSetNavigationBarStyle).not.toHaveBeenCalled();
  });
});
