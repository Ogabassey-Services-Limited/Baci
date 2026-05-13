import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyLoginPage } from './OgabasseyLoginPage';

// Mock dependencies
vi.mock('next/link', () => ({
	default: ({ children }: { children: React.ReactNode }) => children,
}));

const mockPush = vi.fn();
const mockRouter = { push: mockPush };
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
	useRouter: vi.fn(() => mockRouter),
	useSearchParams: vi.fn(() => mockSearchParams),
}));

const mockUseMerchant = vi.fn();
vi.mock('@/hooks/use-merchant-client', () => ({
	useMerchant: () => mockUseMerchant(),
}));

const mockUseCustomerAuth = vi.fn();
vi.mock('@/contexts/customer-auth-context', () => ({
	useCustomerAuth: () => mockUseCustomerAuth(),
}));

vi.mock('@/lib/routes', () => ({
	asRoute: vi.fn((path) => path),
}));

vi.mock('./Logo', () => ({
	Logo: ({ className }: { className?: string }) => (
		<div data-testid="ogabassey-logo" className={className}>
			Logo
		</div>
	),
}));

describe('OgabasseyLoginPage', () => {
	const mockSendOtp = vi.fn();
	const mockVerifyOtp = vi.fn();
	const mockSignInWithGoogle = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		mockSearchParams.get = vi.fn(() => null);

		mockUseMerchant.mockReturnValue({
			loading: false,
		});

		mockUseCustomerAuth.mockReturnValue({
			isAuthenticated: false,
			isLoading: false,
			otpState: { codeSent: false, email: null },
			sendOtp: mockSendOtp,
			verifyOtp: mockVerifyOtp,
			signInWithGoogle: mockSignInWithGoogle,
		});
	});

	describe('Loading States', () => {
		it('shows loading screen when merchant is loading', () => {
			// Arrange
			mockUseMerchant.mockReturnValue({
				loading: true,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			expect(screen.getByText('Loading store data...')).toBeInTheDocument();
			// Verify email form is not shown
			expect(
				screen.queryByRole('textbox', { name: /email address/i }),
			).not.toBeInTheDocument();
		});

		it('shows loading screen when auth is loading', () => {
			// Arrange
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: false,
				isLoading: true,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			expect(
				screen.getByText('Checking authentication...'),
			).toBeInTheDocument();
			// Verify email form is not shown
			expect(
				screen.queryByRole('textbox', { name: /email address/i }),
			).not.toBeInTheDocument();
		});
	});

	describe('Email Form', () => {
		it('renders email form when not loading and not authenticated', () => {
			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			expect(
				screen.getByRole('heading', {
					name: /sign in or create account/i,
				}),
			).toBeInTheDocument();
			expect(
				screen.getByRole('textbox', { name: /email address/i }),
			).toBeInTheDocument();
			expect(
				screen.getByRole('button', { name: /continue with email/i }),
			).toBeInTheDocument();
		});

		it('renders Google sign-in button', () => {
			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			expect(
				screen.getByRole('button', { name: /continue with google/i }),
			).toBeInTheDocument();
		});

		it('sends OTP when email form is submitted', async () => {
			// Arrange
			const user = userEvent.setup();
			mockSendOtp.mockResolvedValue({ success: true });
			render(<OgabasseyLoginPage />);

			// Act
			const emailInput = screen.getByRole('textbox', {
				name: /email address/i,
			});
			await user.type(emailInput, 'test@example.com');
			await user.click(
				screen.getByRole('button', { name: /continue with email/i }),
			);

			// Assert
			await waitFor(() => {
				expect(mockSendOtp).toHaveBeenCalledWith('test@example.com');
			});
		});

		it('displays error message when send OTP fails', async () => {
			// Arrange
			const user = userEvent.setup();
			mockSendOtp.mockResolvedValue({
				success: false,
				error: 'Failed to send code',
			});
			render(<OgabasseyLoginPage />);

			// Act
			const emailInput = screen.getByRole('textbox', {
				name: /email address/i,
			});
			await user.type(emailInput, 'test@example.com');
			await user.click(
				screen.getByRole('button', { name: /continue with email/i }),
			);

			// Assert
			await waitFor(() => {
				expect(screen.getByText('Failed to send code')).toBeInTheDocument();
			});
		});

		it('signs in with Google when Google button is clicked', async () => {
			// Arrange
			const user = userEvent.setup();
			mockSignInWithGoogle.mockResolvedValue({ success: true });
			render(<OgabasseyLoginPage />);

			// Act
			await user.click(
				screen.getByRole('button', { name: /continue with google/i }),
			);

			// Assert
			await waitFor(() => {
				expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
			});
		});

		it('displays error when Google sign-in fails', async () => {
			// Arrange
			const user = userEvent.setup();
			mockSignInWithGoogle.mockResolvedValue({
				success: false,
				error: 'Google sign-in failed',
			});
			render(<OgabasseyLoginPage />);

			// Act
			await user.click(
				screen.getByRole('button', { name: /continue with google/i }),
			);

			// Assert
			await waitFor(() => {
				expect(screen.getByText('Google sign-in failed')).toBeInTheDocument();
			});
		});
	});

	describe('Authentication Redirect', () => {
		it('redirects when already authenticated', async () => {
			// Arrange
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/account');
			});
		});

		it('redirects to specified redirect parameter when authenticated', async () => {
			// Arrange
			mockSearchParams.get = vi.fn(() => '/orders');
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/orders');
			});
		});
	});

	describe('OTP Verification Form', () => {
		beforeEach(() => {
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: false,
				isLoading: false,
				otpState: { codeSent: true, email: 'test@example.com' },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});
		});

		it('shows OTP form when code has been sent', () => {
			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			expect(
				screen.getByRole('heading', { name: /enter verification code/i }),
			).toBeInTheDocument();
			expect(
				screen.getByText(/we sent a 6-digit code to test@example.com/i),
			).toBeInTheDocument();

			// Should have 6 OTP input fields
			const otpInputs = screen.getAllByLabelText(/digit \d of 6/i);
			expect(otpInputs).toHaveLength(6);
		});

		it('verifies OTP when all digits are entered', async () => {
			// Arrange
			const user = userEvent.setup();
			mockVerifyOtp.mockResolvedValue({ success: true });
			render(<OgabasseyLoginPage />);

			// Act
			const otpInputs = screen.getAllByLabelText(/digit \d of 6/i);
			await user.type(otpInputs[0], '1');
			await user.type(otpInputs[1], '2');
			await user.type(otpInputs[2], '3');
			await user.type(otpInputs[3], '4');
			await user.type(otpInputs[4], '5');
			await user.type(otpInputs[5], '6');

			// Assert
			await waitFor(() => {
				expect(mockVerifyOtp).toHaveBeenCalledWith('123456');
			});
		});

		it('displays error when OTP verification fails', async () => {
			// Arrange
			const user = userEvent.setup();
			mockVerifyOtp.mockResolvedValue({
				success: false,
				error: 'Invalid code',
			});
			render(<OgabasseyLoginPage />);

			// Act
			const otpInputs = screen.getAllByLabelText(/digit \d of 6/i);
			await user.type(otpInputs[0], '1');
			await user.type(otpInputs[1], '2');
			await user.type(otpInputs[2], '3');
			await user.type(otpInputs[3], '4');
			await user.type(otpInputs[4], '5');
			await user.type(otpInputs[5], '6');

			// Assert
			await waitFor(() => {
				expect(screen.getByText('Invalid code')).toBeInTheDocument();
			});
		});

		it('resends OTP when resend button is clicked', async () => {
			// Arrange
			const user = userEvent.setup();
			mockSendOtp.mockResolvedValue({ success: true });
			render(<OgabasseyLoginPage />);

			// Act
			await user.click(screen.getByRole('button', { name: /resend code/i }));

			// Assert
			await waitFor(() => {
				expect(mockSendOtp).toHaveBeenCalledWith('test@example.com');
			});
		});

		it('displays error when resend OTP fails', async () => {
			// Arrange
			const user = userEvent.setup();
			mockSendOtp.mockResolvedValue({
				success: false,
				error: 'Failed to resend',
			});
			render(<OgabasseyLoginPage />);

			// Act
			await user.click(screen.getByRole('button', { name: /resend code/i }));

			// Assert
			await waitFor(() => {
				expect(screen.getByText('Failed to resend')).toBeInTheDocument();
			});
		});

		it('clears OTP inputs when "Use a different email" is clicked', async () => {
			// Arrange
			const user = userEvent.setup();
			render(<OgabasseyLoginPage />);

			// Enter some digits first
			const otpInputs = screen.getAllByLabelText(/digit \d of 6/i);
			await user.type(otpInputs[0], '1');
			await user.type(otpInputs[1], '2');

			// Act
			await user.click(
				screen.getByRole('button', { name: /use a different email/i }),
			);

			// Assert
			const clearedInputs = screen.getAllByLabelText(/digit \d of 6/i);
			for (const input of clearedInputs) {
				expect(input).toHaveValue('');
			}
		});
	});

	describe('sanitizeRedirect function', () => {
		it('returns /account for null redirect', async () => {
			// Arrange
			mockSearchParams.get = vi.fn(() => null);
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/account');
			});
		});

		it('returns /account for absolute URLs (starting with //)', async () => {
			// Arrange
			mockSearchParams.get = vi.fn(() => '//evil.com');
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/account');
			});
		});

		it('returns /account for URLs with colons', async () => {
			// Arrange
			mockSearchParams.get = vi.fn(() => 'javascript:alert(1)');
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/account');
			});
		});

		it('returns valid relative paths unchanged', async () => {
			// Arrange
			mockSearchParams.get = vi.fn(() => '/orders/123');
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/orders/123');
			});
		});

		it('returns /account for paths not starting with /', async () => {
			// Arrange
			mockSearchParams.get = vi.fn(() => 'orders');
			mockUseCustomerAuth.mockReturnValue({
				isAuthenticated: true,
				isLoading: false,
				otpState: { codeSent: false, email: null },
				sendOtp: mockSendOtp,
				verifyOtp: mockVerifyOtp,
				signInWithGoogle: mockSignInWithGoogle,
			});

			// Act
			render(<OgabasseyLoginPage />);

			// Assert
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith('/account');
			});
		});
	});
});
