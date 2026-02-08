/**
 * Shared Types for Ogabassey Login Components
 *
 * 2026 Best Practices:
 * - Centralized type definitions
 * - Strict TypeScript interfaces
 * - Reusable across all login components
 */

/**
 * OTP code array type (6 digits)
 */
export type OtpCode = [string, string, string, string, string, string];

/**
 * Props for the loading screen
 */
export interface LoadingScreenProps {
  message?: string;
}

/**
 * Props for the login header
 */
export interface LoginHeaderProps {
  backHref?: string;
  backLabel?: string;
}

/**
 * Props for the email form
 */
export interface EmailFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string;
  isSending: boolean;
  isGoogleLoading: boolean;
  isAppleLoading: boolean;
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
}

/**
 * Props for the OTP code input
 */
export interface OtpCodeInputProps {
  code: OtpCode;
  onCodeChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  isDisabled: boolean;
}

/**
 * Props for the OTP verification form
 */
export interface OtpVerificationFormProps {
  email: string;
  code: OtpCode;
  onCodeChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  error: string;
  isVerifying: boolean;
  isSending: boolean;
}

/**
 * Props for social sign-in buttons
 */
export interface SocialSignInButtonsProps {
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  isGoogleLoading: boolean;
  isAppleLoading: boolean;
  isDisabled: boolean;
}

/**
 * Return type for useOgabasseyLogin hook
 */
export interface UseOgabasseyLoginReturn {
  // State
  email: string;
  code: OtpCode;
  error: string;
  isSending: boolean;
  isVerifying: boolean;
  isGoogleLoading: boolean;
  isAppleLoading: boolean;
  isCodeSent: boolean;
  sentToEmail: string | undefined;

  // Handlers
  setEmail: (email: string) => void;
  handleSendCode: (e: React.FormEvent) => Promise<void>;
  handleCodeChange: (index: number, value: string) => void;
  handleKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleResendCode: () => Promise<void>;
  handleChangeEmail: () => void;
  handleGoogleSignIn: () => Promise<void>;
  handleAppleSignIn: () => Promise<void>;

  // Refs
  codeInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}
