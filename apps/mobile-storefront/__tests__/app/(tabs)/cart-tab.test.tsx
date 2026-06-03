import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import CartTabRedirect from '@/app/(tabs)/cart-tab';

jest.mock('expo-router', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Redirect: ({ href }: { href: string }) => <Text>{`Redirect ${href}`}</Text>,
  };
});

describe('CartTabRedirect', () => {
  it('redirects fallback cart-tab visits to the stack cart route', () => {
    render(<CartTabRedirect />);

    expect(screen.getByText('Redirect /cart')).toBeTruthy();
  });
});
