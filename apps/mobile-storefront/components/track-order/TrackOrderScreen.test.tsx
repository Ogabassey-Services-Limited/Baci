import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { TrackOrderScreen } from '@/components/track-order/TrackOrderScreen';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('TrackOrderScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a missing token error when tracking token is absent', async () => {
    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByText('No tracking token provided')).toBeTruthy();
    });
  });
});
