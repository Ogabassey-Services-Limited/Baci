/**
 * Ogabassey Login Module
 *
 * Modular login page with 2026 best practices:
 * - Full accessibility (WCAG 2.2 AA)
 * - Separated concerns (logic, UI, utils)
 * - Reusable components
 * - Type-safe interfaces
 *
 * @module login
 */

// Main page component
export { OgabasseyLoginPage } from './OgabasseyLoginPage';

// Components
export {
  EmailForm,
  LoadingScreen,
  LoginFooter,
  LoginHeader,
  OtpCodeInput,
  OtpVerificationForm,
  SocialSignInButtons,
} from './components';

// Hooks
export { useOgabasseyLogin } from './hooks';

// Utils
export { sanitizeRedirect } from './utils';

// Types
export type {
  EmailFormProps,
  LoadingScreenProps,
  LoginHeaderProps,
  OtpCode,
  OtpCodeInputProps,
  OtpVerificationFormProps,
  SocialSignInButtonsProps,
  UseOgabasseyLoginReturn,
} from './types';
