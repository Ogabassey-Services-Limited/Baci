// biome-ignore assist/source/organizeImports: harness mocks must load before RegisterScreen.
import {
  fillFormAndSubmit,
  getRegisterScreenMocks,
} from './register-screen-test-harness';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/lib/api-client';
import RegisterScreen from '../../app/(auth)/register';
import { APP_KEYBOARD_CONTAINER_LABEL } from './app-keyboard-container.mock';

const mocks = getRegisterScreenMocks();

describe('RegisterScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutateAsync.mockResolvedValue({ success: true });
    mocks.signIn.mockResolvedValue({ error: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('submits the normalized registration payload', async () => {
    render(<RegisterScreen />);
    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeTruthy();
    fillFormAndSubmit();

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    const [payload] = mocks.mutateAsync.mock.calls[0];
    expect(payload).toMatchObject({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      businessName: 'Test Store',
      businessType: 'fashion',
      country: 'IN',
    });
  });

  it('clears stale otherBusinessType when switching away from Other', async () => {
    render(<RegisterScreen />);

    fireEvent.change(screen.getByPlaceholderText('John'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Doe'), {
      target: { value: 'User' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    const passwordFields = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordFields[0], {
      target: { value: 'StrongP@ss123!' },
    });
    fireEvent.change(passwordFields[1], {
      target: { value: 'StrongP@ss123!' },
    });

    fireEvent.click(screen.getByText('Next Step'));
    fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
      target: { value: 'Test Store' },
    });

    fireEvent.click(screen.getByText('Other'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Pet Supplies'), {
      target: { value: 'Custom Type' },
    });
    fireEvent.click(screen.getByText('Fashion & Apparel'));
    fireEvent.click(screen.getByText('Launch Store'));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    const [payload] = mocks.mutateAsync.mock.calls[0];
    expect(payload).toMatchObject({
      businessType: 'fashion',
      otherBusinessType: '',
    });
  });

  describe('onSuccess', () => {
    it('establishes the client session when registration unmounts before onboarding resolves', async () => {
      let resolveRegistration: (() => void) | undefined;
      mocks.mutateAsync.mockReturnValue(
        new Promise((resolve) => {
          resolveRegistration = () => resolve({ success: true });
        })
      );
      const rendered = render(<RegisterScreen />);

      fillFormAndSubmit();
      rendered.unmount();
      await act(async () => resolveRegistration?.());

      await waitFor(() => {
        expect(mocks.signIn).toHaveBeenCalledWith(
          'test@example.com',
          'StrongP@ss123!'
        );
      });
    });

    it('establishes the new account session before navigating to the dashboard', async () => {
      render(<RegisterScreen />);
      fillFormAndSubmit();

      await waitFor(() => {
        expect(mocks.replace).toHaveBeenCalledWith('/(admin)/(tabs)');
      });
      expect(mocks.signIn).toHaveBeenCalledWith(
        'test@example.com',
        'StrongP@ss123!'
      );
      expect(mocks.signIn.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.replace.mock.invocationCallOrder[0]
      );
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('stays on registration when the new session cannot be established', async () => {
      mocks.signIn.mockResolvedValue({ error: 'Invalid login credentials' });
      render(<RegisterScreen />);
      fillFormAndSubmit();

      await waitFor(() => expect(mocks.alert).toHaveBeenCalled());
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.alert).toHaveBeenCalledWith(
        'Store Created',
        'Your store was created, but we could not sign you in automatically. Please sign in with your new account.',
        expect.any(Array)
      );
    });
  });

  describe('onError', () => {
    it('shows an account conflict and navigates only when its login action is pressed', async () => {
      mocks.mutateAsync.mockRejectedValue(
        new NetworkError('User already exists', { statusCode: 409 })
      );
      render(<RegisterScreen />);
      fillFormAndSubmit();

      await waitFor(() => expect(mocks.alert).toHaveBeenCalled());
      expect(mocks.alert).toHaveBeenCalledWith(
        'Account Exists',
        'An account with this email already exists. Please log in instead.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Go to Login' }),
          expect.objectContaining({ text: 'OK', style: 'cancel' }),
        ])
      );
      const buttons = mocks.alert.mock.calls[0][2] as Array<{
        text: string;
        onPress?: () => void;
      }>;
      buttons.find((b) => b.text === 'Go to Login')?.onPress?.();

      expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('shows a rate-limit error without navigating', async () => {
      mocks.mutateAsync.mockRejectedValue(
        new NetworkError('Too many attempts', { statusCode: 429 })
      );
      render(<RegisterScreen />);
      fillFormAndSubmit();

      await waitFor(() => expect(mocks.alert).toHaveBeenCalled());
      expect(mocks.alert).toHaveBeenCalledWith(
        'Too Many Attempts',
        'Please wait a minute before trying again.'
      );
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });
});
