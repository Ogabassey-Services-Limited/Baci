import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOgabasseyLogin } from './useOgabasseyLogin';

const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

interface MockOtpState {
  codeSent: boolean;
  email?: string;
}

const mockSendOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockSignInWithApple = vi.fn();
let mockOtpState: MockOtpState | null = null;

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => ({
    otpState: mockOtpState,
    sendOtp: mockSendOtp,
    signInWithApple: mockSignInWithApple,
    signInWithGoogle: mockSignInWithGoogle,
    verifyOtp: mockVerifyOtp,
  }),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

describe('useOgabasseyLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOtpState = null;
    mockSendOtp.mockResolvedValue({ success: true });
    mockVerifyOtp.mockResolvedValue({ success: true });
    mockSignInWithGoogle.mockResolvedValue({ success: true });
    mockSignInWithApple.mockResolvedValue({ success: true });
  });

  it('syncs the email when an untouched initial email changes before OTP starts', () => {
    const { rerender, result } = renderHook(
      ({ initialEmail }) =>
        useOgabasseyLogin({ initialEmail, redirectTo: '/account' }),
      { initialProps: { initialEmail: 'first@example.com' } }
    );

    expect(result.current.email).toBe('first@example.com');

    rerender({ initialEmail: 'second@example.com' });

    expect(result.current.email).toBe('second@example.com');
  });

  it('does not overwrite a user-edited email when initial email changes', () => {
    const { rerender, result } = renderHook(
      ({ initialEmail }) =>
        useOgabasseyLogin({ initialEmail, redirectTo: '/account' }),
      { initialProps: { initialEmail: 'first@example.com' } }
    );

    act(() => {
      result.current.setEmail('typed@example.com');
    });
    rerender({ initialEmail: 'second@example.com' });

    expect(result.current.email).toBe('typed@example.com');
  });

  it('does not sync initial email changes after OTP starts', () => {
    const { rerender, result } = renderHook(
      ({ initialEmail }) =>
        useOgabasseyLogin({ initialEmail, redirectTo: '/account' }),
      { initialProps: { initialEmail: 'first@example.com' } }
    );

    mockOtpState = { codeSent: true, email: 'first@example.com' };
    rerender({ initialEmail: 'second@example.com' });

    expect(result.current.email).toBe('first@example.com');
  });
});
