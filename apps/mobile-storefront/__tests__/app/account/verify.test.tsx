import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import AccountVerifyRoute from '@/app/account/verify';

type PendingAuthLoginResumeState = {
  email: string;
  returnTo: string | null;
  step: 'otp';
};

const mockRedirect = jest.fn(({ href }: { href: unknown }) => (
  <Text>{`Redirect:${JSON.stringify(href)}`}</Text>
));
const mockStackScreen = jest.fn<(props: { options?: unknown }) => null>(
  () => null
);
const mockGetPendingAuthLoginResumeState =
  jest.fn<() => Promise<PendingAuthLoginResumeState | null>>();
const mockUseLocalSearchParams = jest.fn<() => Record<string, string>>();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => mockRedirect({ href }),
  Stack: {
    Screen: (props: { options?: unknown }) => mockStackScreen(props),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/auth/login-resume-state', () => ({
  getPendingAuthLoginResumeState: () => mockGetPendingAuthLoginResumeState(),
}));

describe('AccountVerifyRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPendingAuthLoginResumeState.mockResolvedValue(null);
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('routes branded OTP email links to the native OTP login screen', async () => {
    render(<AccountVerifyRoute />);

    const expectedHref = {
      pathname: '/auth/login',
      params: { mode: 'otp' },
    };

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith({ href: expectedHref });
    });
    expect(mockStackScreen).toHaveBeenCalledWith({
      options: { headerShown: false },
    });
    expect(
      screen.getByText(`Redirect:${JSON.stringify(expectedHref)}`)
    ).toBeOnTheScreen();
  });

  it('preserves pending protected-flow returnTo when opening the OTP login screen', async () => {
    mockUseLocalSearchParams.mockReturnValueOnce({
      returnTo: '/cart',
      token_hash: 'supabase-token-hash',
      type: 'email',
    });
    mockGetPendingAuthLoginResumeState.mockResolvedValueOnce({
      email: 'shopper@example.com',
      returnTo: '/checkout',
      step: 'otp',
    });

    render(<AccountVerifyRoute />);

    const expectedHref = {
      pathname: '/auth/login',
      params: {
        mode: 'otp',
        returnTo: '/checkout',
        token_hash: 'supabase-token-hash',
        type: 'email',
      },
    };

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith({ href: expectedHref });
    });
    expect(screen.getByText(/^Redirect:/)).toBeOnTheScreen();
  });

  it('preserves Supabase verification query params when opening the OTP login screen', async () => {
    mockUseLocalSearchParams.mockReturnValueOnce({
      token_hash: '12345',
      type: 'email',
    });

    render(<AccountVerifyRoute />);

    const expectedHref = {
      pathname: '/auth/login',
      params: {
        mode: 'otp',
        token_hash: '12345',
        type: 'email',
      },
    };

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith({ href: expectedHref });
    });
    expect(screen.getByText(/^Redirect:/)).toBeOnTheScreen();
  });

  it('falls back to the OTP login screen when pending resume state cannot be read', async () => {
    mockGetPendingAuthLoginResumeState.mockRejectedValueOnce(
      new Error('secure storage unavailable')
    );

    render(<AccountVerifyRoute />);

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: '/auth/login',
          params: { mode: 'otp' },
        },
      });
    });
  });
});
