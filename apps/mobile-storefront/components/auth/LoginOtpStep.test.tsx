import { jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Alert } from 'react-native';
import { LoginOtpStep } from '@/components/auth/LoginOtpStep';
import Colors from '@/constants/Colors';

type LoginOtpStepProps = ComponentProps<typeof LoginOtpStep>;

function makeProps(
  overrides: Partial<LoginOtpStepProps> = {}
): LoginOtpStepProps {
  return {
    colors: Colors.light,
    dismissAndNavigate: jest.fn<LoginOtpStepProps['dismissAndNavigate']>(),
    email: 'shopper@example.com',
    isLoading: false,
    isMountedRef: { current: true } as LoginOtpStepProps['isMountedRef'],
    isVerifyingRef: { current: false } as LoginOtpStepProps['isVerifyingRef'],
    onResendOtp: jest
      .fn<LoginOtpStepProps['onResendOtp']>()
      .mockResolvedValue(undefined),
    otp: '123456',
    otpError: null,
    otpInputRef: { current: null } as LoginOtpStepProps['otpInputRef'],
    setOtp: jest.fn<LoginOtpStepProps['setOtp']>(),
    setOtpError: jest.fn<LoginOtpStepProps['setOtpError']>(),
    verifyOtp: jest
      .fn<LoginOtpStepProps['verifyOtp']>()
      .mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe('LoginOtpStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders OTP verification content and validation feedback', () => {
    render(
      <LoginOtpStep {...makeProps({ otpError: 'Enter the 6-digit code' })} />
    );

    expect(screen.getByText('Verify Your Email')).toBeOnTheScreen();
    expect(screen.getByText('shopper@example.com')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('000000')).toBeOnTheScreen();
    expect(screen.getByText('Enter the 6-digit code')).toBeOnTheScreen();
  });

  it('updates OTP input and clears an existing OTP error', () => {
    const props = makeProps({ otpError: 'Enter the 6-digit code' });

    render(<LoginOtpStep {...props} />);

    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123');

    expect(props.setOtp).toHaveBeenCalledWith('123');
    expect(props.setOtpError).toHaveBeenCalledWith(null);
    expect(props.verifyOtp).not.toHaveBeenCalled();
  });

  it('auto-submits a complete code and dismisses on success', async () => {
    const props = makeProps();

    render(<LoginOtpStep {...props} otp="" />);

    fireEvent.changeText(screen.getByPlaceholderText('000000'), '654321');

    await waitFor(() => {
      expect(props.verifyOtp).toHaveBeenCalledWith(
        'shopper@example.com',
        '654321'
      );
      expect(props.dismissAndNavigate).toHaveBeenCalledTimes(1);
    });
  });

  it('submits the current code when the verify button is pressed', async () => {
    const props = makeProps({ otp: '111222' });

    render(<LoginOtpStep {...props} />);

    fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(props.verifyOtp).toHaveBeenCalledWith(
        'shopper@example.com',
        '111222'
      );
      expect(props.dismissAndNavigate).toHaveBeenCalledTimes(1);
    });
  });

  it('sets a validation error before submitting an invalid code', () => {
    const props = makeProps({ otp: '12' });

    render(<LoginOtpStep {...props} />);

    fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    expect(props.setOtpError).toHaveBeenCalledWith(expect.any(String));
    expect(props.verifyOtp).not.toHaveBeenCalled();
  });

  it('alerts when verification fails', async () => {
    const props = makeProps({
      verifyOtp: jest.fn<LoginOtpStepProps['verifyOtp']>().mockResolvedValue({
        error: 'Invalid code',
        success: false,
      }),
    });

    render(<LoginOtpStep {...props} />);

    fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Invalid code');
      expect(props.dismissAndNavigate).not.toHaveBeenCalled();
    });
  });

  it('resends OTP only after the cooldown expires', async () => {
    jest.useFakeTimers();
    const props = makeProps();

    render(<LoginOtpStep {...props} />);

    expect(
      screen.getByRole('button', {
        name: /resend code in 60 seconds/i,
      })
    ).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Resend code' }));
      await Promise.resolve();
    });

    expect(props.onResendOtp).toHaveBeenCalledTimes(1);
  });

  it('does not restart the resend cooldown when resend returns false', async () => {
    jest.useFakeTimers();
    const props = makeProps({
      onResendOtp: jest
        .fn<LoginOtpStepProps['onResendOtp']>()
        .mockResolvedValue(false),
    });

    render(<LoginOtpStep {...props} />);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Resend code' }));
      await Promise.resolve();
    });

    expect(props.onResendOtp).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Resend code' })
    ).not.toBeDisabled();
  });

  it('marks the verify button disabled and busy while loading', () => {
    render(<LoginOtpStep {...makeProps({ isLoading: true })} />);

    expect(
      screen.getByRole('button', {
        name: 'Verifying code',
        disabled: true,
        busy: true,
      })
    ).toBeDisabled();
  });
});
