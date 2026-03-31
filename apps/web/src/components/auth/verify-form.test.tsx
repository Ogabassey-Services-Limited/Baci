import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- vi.hoisted: these variables are available inside vi.mock factories ---
const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
  verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  resend: vi.fn().mockResolvedValue({ error: null }),
  toast: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      resend: mocks.resend,
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
  useSearchParams: () => new URLSearchParams('email=test@example.com'),
}));

vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => React.createElement('a', { href }, children),
  };
});

vi.mock('@/components/logo', async () => {
  const React = await import('react');
  return {
    Logo: () => React.createElement('div', null, 'Logo'),
  };
});

vi.mock('lucide-react', async () => {
  const React = await import('react');
  return {
    ArrowRight: () => React.createElement('span', null, 'ArrowRight'),
    Loader2: () => React.createElement('span', null, 'Loader2'),
  };
});

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');
  return {
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      children: React.ReactNode;
    }) => React.createElement('button', props, children),
  };
});

vi.mock('@/components/ui/form', async () => {
  const React = await import('react');
  const rhf = await import('react-hook-form');
  return {
    Form: rhf.FormProvider as unknown,
    FormField: ({
      render,
      name,
      control,
    }: {
      render: (props: {
        field: { value: string; onChange: (v: string) => void; name: string };
      }) => React.ReactNode;
      name: string;
      control?: unknown;
    }) => {
      const { field } = (
        rhf as { useController: (...args: any[]) => any }
      ).useController({
        name,
        control,
      });
      return React.createElement(React.Fragment, null, render({ field }));
    },
    FormItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    FormControl: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    FormMessage: () => null,
  };
});

vi.mock('@/components/ui/input-otp', async () => {
  const React = await import('react');
  return {
    InputOTP: ({
      children,
      maxLength,
      ...props
    }: {
      children: React.ReactNode;
      maxLength: number;
      value?: string;
      onChange?: (v: string) => void;
    }) => {
      return React.createElement(
        'div',
        { 'data-testid': 'input-otp' },
        React.createElement('input', {
          'data-testid': 'otp-input',
          maxLength,
          value: props.value ?? '',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            props.onChange?.(e.target.value),
        }),
        children
      );
    },
    InputOTPGroup: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    InputOTPSlot: ({ index }: { index: number }) =>
      React.createElement('div', { 'data-testid': `otp-slot-${index}` }),
    InputOTPSeparator: () => React.createElement('span', null, '-'),
  };
});

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (values: Record<string, unknown>) => ({
    values,
    errors: {},
  }),
}));

// --- Import component after mocks ---
import VerifyForm from './verify-form';

describe('VerifyForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('resend', () => {
    it('calls signInWithOtp with shouldCreateUser false', async () => {
      render(<VerifyForm />);

      // Advance past the 30s initial timer
      act(() => {
        vi.advanceTimersByTime(31000);
      });

      // Find the resend button
      const resendButton = screen.getByText('Click to resend');
      await act(() => {
        fireEvent.click(resendButton);
      });

      expect(mocks.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: { shouldCreateUser: false },
      });
      // Ensure the old resend method was NOT called
      expect(mocks.resend).not.toHaveBeenCalled();
    });

    it('shows success toast on success', async () => {
      mocks.signInWithOtp.mockResolvedValueOnce({ error: null });
      render(<VerifyForm />);

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      const resendButton = screen.getByText('Click to resend');
      await act(() => {
        fireEvent.click(resendButton);
      });

      expect(mocks.toast).toHaveBeenCalledWith({
        title: 'Code Sent',
        description: 'A new verification code has been sent to your email.',
      });
    });

    it('shows error toast on failure', async () => {
      mocks.signInWithOtp.mockRejectedValueOnce(
        new Error('Rate limit exceeded')
      );
      render(<VerifyForm />);

      act(() => {
        vi.advanceTimersByTime(31000);
      });

      const resendButton = screen.getByText('Click to resend');
      await act(() => {
        fireEvent.click(resendButton);
      });

      expect(mocks.toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Error',
        description: 'Rate limit exceeded',
      });
    });

    it('is blocked while timer > 0', async () => {
      render(<VerifyForm />);

      // Do NOT advance timers, timer is still 30
      const countdownButton = screen.getByText(/Resend code in/);
      expect(countdownButton).toBeTruthy();

      await act(() => {
        fireEvent.click(countdownButton);
      });

      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });
  });

  describe('verify with fallback', () => {
    it('succeeds via email type fallback after signup type fails', async () => {
      // First verifyOtp (type: 'signup') returns error
      mocks.verifyOtp
        .mockResolvedValueOnce({
          error: { message: 'Invalid OTP for signup' },
        })
        // Second verifyOtp (type: 'email') succeeds
        .mockResolvedValueOnce({ error: null });

      render(<VerifyForm />);

      // Type a 6-digit code into the OTP input
      const otpInput = screen.getByTestId('otp-input');
      await act(() => {
        fireEvent.change(otpInput, { target: { value: '123456' } });
      });

      // Submit the form by clicking Verify Email
      const verifyButton = screen.getByText('Verify Email');
      await act(() => {
        fireEvent.click(verifyButton);
      });

      // Both OTP types should have been attempted
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'signup',
      });
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'email',
      });

      // Success toast should be shown
      expect(mocks.toast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Your email has been verified.',
      });
    });
  });
});
