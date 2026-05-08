/**
 * Checkout Identity Modal Module
 *
 * Modular checkout identity selection with 2026 best practices:
 * - Full accessibility (WCAG 2.2 AA)
 * - Reduced motion support
 * - Haptic feedback
 * - User-friendly error messages
 *
 * @module checkout-identity
 */

export { CheckoutIdentityModal } from './CheckoutIdentityModal';
export type { TabType } from './components';

// Re-export subcomponents for potential reuse
export {
  CreateAccountCard,
  Divider,
  EmailInput,
  ErrorAlert,
  GuestCheckoutCard,
  PasswordInput,
  SecurityFooter,
  SignInForm,
  SocialSignInButtons,
  SubmitButton,
  TabSelector,
} from './components';

// Re-export hooks for potential reuse
export { useBottomSheetAnimation, useHapticFeedback, useSignInForm } from './hooks';

// Re-export types
export type {
  EmailInputProps,
  ErrorAlertProps,
  FormInputProps,
  PasswordInputProps,
  SignInFormData,
  SignInFormProps,
  SocialSignInButtonsProps,
  SubmitButtonProps,
  UseSignInFormReturn,
} from './types';

// Re-export utils
export {
  AUTH_ERROR_MESSAGES,
  getUserFriendlyError,
  signInSchema,
  VALIDATION_ERROR_MESSAGES,
} from './utils';
