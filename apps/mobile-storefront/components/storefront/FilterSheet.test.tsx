import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { FilterSheet } from './FilterSheet';

jest.mock('@react-native-vector-icons/ionicons', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: {
      View,
    },
    SlideInDown: {
      duration: () => ({
        springify: () => undefined,
      }),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

jest.mock('@/components/ui/AppKeyboardContainer', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({
      children,
      style,
    }: {
      children: ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
  };
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      border: '#E5E7EB',
      card: '#FFFFFF',
      icon: '#111827',
      muted: '#F3F4F6',
      placeholder: '#9CA3AF',
      text: '#111827',
      textSecondary: '#4B5563',
    },
  }),
}));

describe('FilterSheet', () => {
  it('normalizes invalid and reversed price inputs before applying', () => {
    const onApplyFilter = jest.fn();

    render(
      <FilterSheet
        visible={true}
        minPrice={0}
        maxPrice={3000000}
        onClose={jest.fn()}
        onApplyFilter={onApplyFilter}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText('0'), 'bad');
    fireEvent.changeText(screen.getByPlaceholderText('3000000'), '-20');
    fireEvent.press(screen.getByLabelText('Apply price filter'));

    expect(onApplyFilter).toHaveBeenCalledWith(0, 0);
  });

  it('clamps and orders price inputs before applying filters', () => {
    const onApplyFilter = jest.fn();

    render(
      <FilterSheet
        visible={true}
        minPrice={4000000}
        maxPrice={100}
        onClose={jest.fn()}
        onApplyFilter={onApplyFilter}
      />
    );

    fireEvent.press(screen.getByLabelText('Apply price filter'));

    expect(onApplyFilter).toHaveBeenCalledWith(100, 3000000);
  });
});
