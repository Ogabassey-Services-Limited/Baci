import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import AccountVerifyRoute from '@/app/account/verify';

const mockRedirect = jest.fn(({ href }: { href: unknown }) => (
  <Text>{`Redirect:${JSON.stringify(href)}`}</Text>
));
const mockStackScreen = jest.fn<(props: { options?: unknown }) => null>(
  () => null
);

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => mockRedirect({ href }),
  Stack: {
    Screen: (props: { options?: unknown }) => mockStackScreen(props),
  },
}));

describe('AccountVerifyRoute', () => {
  it('routes branded OTP email links to the native OTP login screen', () => {
    render(<AccountVerifyRoute />);

    const expectedHref = {
      pathname: '/auth/login',
      params: { mode: 'otp' },
    };

    expect(mockRedirect).toHaveBeenCalledWith({ href: expectedHref });
    expect(mockStackScreen).toHaveBeenCalledWith({
      options: { headerShown: false },
    });
    expect(
      screen.getByText(`Redirect:${JSON.stringify(expectedHref)}`)
    ).toBeOnTheScreen();
  });
});
