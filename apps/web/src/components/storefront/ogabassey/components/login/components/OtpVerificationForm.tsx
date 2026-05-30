/**
 * OtpVerificationForm Component
 *
 * 2026 Best Practices:
 * - Full accessibility
 * - Loading and error states
 * - Clear user feedback
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { OtpVerificationFormProps } from '../types';
import { OtpCodeInput } from './OtpCodeInput';

/**
 * OTP verification form with resend option
 */
export function OtpVerificationForm({
  code,
  onCodeChange,
  onKeyDown,
  onPaste,
  onResend,
  onChangeEmail,
  error,
  isVerifying,
  isSending,
  inputRefs,
}: OtpVerificationFormProps & {
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-gray-700">Verification code</Label>
        <OtpCodeInput
          code={code}
          onCodeChange={onCodeChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          isDisabled={isVerifying}
          inputRefs={inputRefs}
        />
      </div>

      {error && (
        <p className="text-sm text-center text-primary" role="alert">
          {error}
        </p>
      )}

      {isVerifying && (
        <div
          className="flex items-center justify-center gap-2 text-gray-500"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          <span>Verifying…</span>
        </div>
      )}

      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">Didn't receive the code?</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hover:bg-gray-100 text-primary"
          onClick={onResend}
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Resend code'}
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl"
        onClick={onChangeEmail}
      >
        Use a different email
      </Button>
    </div>
  );
}
