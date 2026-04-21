import { fireEvent, render, screen } from '@testing-library/react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { CompactStackHeader } from './CompactStackHeader';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

function createProps(
  overrides: Partial<NativeStackHeaderProps> = {}
): NativeStackHeaderProps {
  return {
    back: undefined,
    navigation: {
      goBack: jest.fn(),
    } as unknown as NativeStackHeaderProps['navigation'],
    options: {},
    route: {
      key: 'settings-key',
      name: 'settings/index',
    },
    ...overrides,
  };
}

describe('CompactStackHeader', () => {
  it('renders the provided title and default back action', () => {
    const goBack = jest.fn();

    render(
      <CompactStackHeader
        {...createProps({
          back: { title: 'Home', href: undefined },
          navigation: { goBack } as unknown as NativeStackHeaderProps['navigation'],
          options: { title: 'Settings' },
        })}
      />
    );

    expect(screen.getByText('Settings')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('renders custom right actions when provided', () => {
    render(
      <CompactStackHeader
        {...createProps({
          options: {
            title: 'Compare',
            headerRight: () => <Text>Clear All</Text>,
          },
        })}
      />
    );

    expect(screen.getByText('Clear All')).toBeTruthy();
  });

  it('uses a sanitized fallback title that strips expo-router group segments', () => {
    render(
      <CompactStackHeader
        {...createProps({
          route: {
            key: 'cart-key',
            name: '(tabs)/cart',
          },
        })}
      />
    );

    expect(screen.getByText('Cart')).toBeTruthy();
    expect(screen.queryByText('(tabs)')).toBeNull();
  });

  it('renders nothing when the screen header is hidden', () => {
    const { toJSON } = render(
      <CompactStackHeader
        {...createProps({
          options: {
            headerShown: false,
            title: 'Cart',
          },
        })}
      />
    );

    expect(toJSON()).toBeNull();
    expect(screen.queryByText('Cart')).toBeNull();
  });

  it('disappears cleanly when rerendered from visible to hidden', () => {
    const view = render(
      <CompactStackHeader
        {...createProps({
          options: {
            title: 'Cart',
          },
        })}
      />
    );

    expect(screen.getByText('Cart')).toBeTruthy();

    view.rerender(
      <CompactStackHeader
        {...createProps({
          options: {
            headerShown: false,
            title: 'Cart',
          },
        })}
      />
    );

    expect(view.toJSON()).toBeNull();
    expect(screen.queryByText('Cart')).toBeNull();
  });
});
